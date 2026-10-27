import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { Server } from "http";
import { AddressInfo } from "net";
import { buildApp } from "./index";
import { closeDb } from "./db";
import { generateFixture } from "../../scripts/make-fixture";
import type { CheckResponse, ScanResponse, NodeWithEvidence } from "../../shared/types";

let tmp: string;
let dbFile: string;
let fixtureRoot: string;
let server: Server;
let base: string;

async function req<T>(p: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}/api${p}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-e2e-"));
  dbFile = path.join(tmp, "app-data.db");
  process.env.CF_DB_PATH = dbFile;
  closeDb();
  const fixture = await generateFixture(path.join(tmp, "demo-repo"));
  fixtureRoot = fixture.root;
  const app = buildApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  closeDb();
  delete process.env.CF_DB_PATH;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("P0 acceptance loop end to end", () => {
  it("opens the fixture repository", async () => {
    const { status, body } = await req<{ project: { id: string; displayName: string } }>("/projects", {
      method: "POST",
      body: JSON.stringify({ rootPath: fixtureRoot }),
    });
    expect(status).toBe(201);
    expect(body.project.displayName).toBe("demo-repo");
  });

  it("discovers rule candidates with exact evidence", async () => {
    const project = (await req<{ project: { id: string } }>("/projects", { method: "POST", body: JSON.stringify({ rootPath: fixtureRoot }) })).body.project;
    const scan = (await req<ScanResponse>(`/projects/${project.id}/scan`, { method: "POST" })).body;
    expect((scan.summary?.parsed ?? 0)).toBeGreaterThan(5);
    expect(scan.discovery?.total ?? 0).toBeGreaterThan(5);

    const nodes = (await req<{ nodes: NodeWithEvidence[] }>(`/projects/${project.id}/nodes`)).body.nodes;
    const rule = nodes.find((n) => n.node.title.includes("repository layer") && n.node.type === "principle");
    expect(rule).toBeDefined();
    expect(rule!.node.status).toBe("candidate");
    expect(rule!.evidence[0].sourcePath).toBe("PROJECT-CORE.md");
    expect(rule!.evidence[0].startLine).toBe(7);
    expect(rule!.evidence[0].excerpt).toContain("repository layer");
    expect(rule!.evidence[0].classification).toBe("explicit-rule");

    const decision = nodes.find((n) => n.node.type === "decision");
    expect(decision?.node.content).toContain("Status: accepted");
    const unapproved = nodes.find((n) => n.node.title.includes("tests for new endpoints"));
    expect(unapproved?.node.status).toBe("candidate");
  });

  it("completes the full loop: approve → pack → export → graph → check → finding → disposition", async () => {
    const project = (await req<{ project: { id: string } }>("/projects", { method: "POST", body: JSON.stringify({ rootPath: fixtureRoot }) })).body.project;
    const projectId = project.id;

    await req(`/projects/${projectId}/scan`, { method: "POST" });
    const nodes = (await req<{ nodes: NodeWithEvidence[] }>(`/projects/${projectId}/nodes`)).body.nodes;
    const rule = nodes.find((n) => n.node.title.includes("repository layer") && n.node.type === "principle")!;

    const approved = await req<{ node: NodeWithEvidence["node"] }>(`/projects/${projectId}/nodes/${rule.node.id}/review`, {
      method: "POST",
      body: JSON.stringify({
        action: "approve",
        content: "All database access must go through the repository layer in src.\nForbidden pattern: \\bquery\\s*\\( in src/services",
      }),
    });
    expect(approved.body.node.status).toBe("user-approved");

    const pack = await req<{ pack: { content: string; counts: { approvedRules: number } } }>(`/projects/${projectId}/pack/generate`, { method: "POST" });
    expect(pack.body.pack.counts.approvedRules).toBeGreaterThan(0);
    expect(pack.body.pack.content).toContain("repository layer");
    expect(pack.body.pack.content).toMatch(/PROJECT-CORE\.md:\d+/);
    expect(pack.body.pack.content).toContain("Forbidden pattern");
    expect(pack.body.pack.content).toContain("machine-discovered candidate");

    const exportRes = await req<{ writtenTo: string }>(`/projects/${projectId}/pack/export`, {
      method: "POST",
      body: JSON.stringify({ filename: "CARRYFORWARD-INSTRUCTIONS.md" }),
    });
    expect(exportRes.body.writtenTo).toBe("CARRYFORWARD-INSTRUCTIONS.md");
    expect(fs.existsSync(path.join(fixtureRoot, "CARRYFORWARD-INSTRUCTIONS.md"))).toBe(true);

    const graphRes = await fetch(`${base}/api/projects/${projectId}/graph/export`);
    const graph = (await graphRes.json()) as { nodes: unknown[]; edges: unknown[]; evidence: unknown[] };
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    const check = await req<CheckResponse>(`/projects/${projectId}/check`, {
      method: "POST",
      body: JSON.stringify({ source: "unstaged" }),
    });
    expect(check.body.files.length).toBeGreaterThan(0);
    const finding = check.body.findings.find((f) => f.kind === "prohibited-pattern");
    expect(finding).toBeDefined();
    expect(finding!.certainty).toBe("deterministic");
    expect(finding!.blocking).toBe(true);
    expect(finding!.ruleEvidence).toContain("PROJECT-CORE.md:7");
    expect(finding!.changedEvidence).toContain("db.query");
    expect(finding!.changedPath).toBe("src/services/user-service.ts");

    const disposition = await req<{ ok: boolean }>(`/projects/${projectId}/findings/${finding!.id}/disposition`, {
      method: "POST",
      body: JSON.stringify({ disposition: "fixed" }),
    });
    expect(disposition.body.ok).toBe(true);

    const persisted = await req<{ findings: CheckResponse["findings"] }>(`/projects/${projectId}/check`);
    expect(persisted.body.findings.find((f) => f.id === finding!.id)?.disposition).toBe("fixed");
  });

  it("survives an app restart with approvals intact", async () => {
    const project = (await req<{ project: { id: string } }>("/projects", { method: "POST", body: JSON.stringify({ rootPath: fixtureRoot }) })).body.project;
    const server2 = buildApp().listen(0);
    await new Promise<void>((resolve) => server2.once("listening", resolve));
    const base2 = `http://localhost:${(server2.address() as AddressInfo).port}`;
    try {
      const res = await fetch(`${base2}/api/projects/${project.id}/nodes`);
      const nodes = (await res.json()) as { nodes: NodeWithEvidence[] };
      const rule = nodes.nodes.find((n) => n.node.title.includes("repository layer") && n.node.status === "user-approved");
      expect(rule).toBeDefined();
      expect(rule!.node.approvedBy).toBe("local-user");
    } finally {
      await new Promise<void>((resolve) => server2.close(() => resolve()));
    }
  });

  it("handles empty repositories and invalid paths honestly", async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-empty-"));
    try {
      const project = (await req<{ project: { id: string } }>("/projects", { method: "POST", body: JSON.stringify({ rootPath: emptyDir }) })).body.project;
      const scan = await req<ScanResponse>(`/projects/${project.id}/scan`, { method: "POST" });
      expect(scan.body.summary.parsed).toBe(0);
      const overview = await req<{ totals: { nodes: number } }>(`/projects/${project.id}/overview`);
      expect(overview.body.totals.nodes).toBe(0);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }

    const bad = await req<{ error: string }>("/projects", { method: "POST", body: JSON.stringify({ rootPath: "C:\\definitely\\not\\a\\real\\path" }) });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("does not exist");
  });
});
