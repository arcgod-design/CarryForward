import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { discoverFromScan, fileRole } from "./extractor";
import { buildKnowledge } from "./graph";
import { getDb, closeDb } from "./db";
import * as store from "./store";

let tmp: string;
let dbFile: string;

function write(rel: string, content: string): string {
  const target = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return rel;
}

function parsed(rels: string[]): { relativePath: string; size: number }[] {
  return rels.map((relativePath) => ({ relativePath, size: 10 }));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-ext-"));
  dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cf-db-")), "t.db");
  process.env.CF_DB_PATH = dbFile;
  closeDb();
});

afterEach(() => {
  closeDb();
  delete process.env.CF_DB_PATH;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
});

describe("fileRole", () => {
  it("recognizes known and generic files", () => {
    expect(fileRole("AGENTS.md")).toBe("agent-instructions");
    expect(fileRole("CLAUDE.md")).toBe("agent-instructions");
    expect(fileRole(".github/copilot-instructions.md")).toBe("agent-instructions");
    expect(fileRole("PROJECT-CORE.md")).toBe("core");
    expect(fileRole("PROJECT_STATUS.md")).toBe("status");
    expect(fileRole("doc-of-journey/decisions/0001-repo-layer.md")).toBe("decision-record");
    expect(fileRole("docs/ARCHITECTURE.md")).toBe("docs");
    expect(fileRole("package.json")).toBe("manifest");
    expect(fileRole("src/app.ts")).toBe("code");
    expect(fileRole("random-notes.md")).toBe("other");
  });
});

describe("discoverFromScan", () => {
  it("extracts rules from core docs with exact line evidence", async () => {
    const rel = write(
      "PROJECT-CORE.md",
      "# Core\n\n## Principles\n\n- All database access must go through the repository layer.\n- Never commit directly to main.\n"
    );
    const result = await discoverFromScan(tmp, parsed([rel]));
    const repoRule = result.items.find((i) => i.content.includes("repository layer"));
    expect(repoRule).toBeDefined();
    expect(repoRule?.type).toBe("principle");
    expect(repoRule?.classification).toBe("explicit-rule");
    expect(repoRule?.startLine).toBe(5);
    expect(repoRule?.excerpt).toBe("All database access must go through the repository layer.");
  });

  it("treats rule language outside core/agent docs as inferred candidates", async () => {
    const rel = write("docs/NOTES.md", "# Notes\n\n## Conventions\n\nTests must run before every commit.\n");
    const result = await discoverFromScan(tmp, parsed([rel]));
    const item = result.items.find((i) => i.content.includes("Tests must run"));
    expect(item?.classification).toBe("inferred-candidate");
    expect(item?.type).toBe("convention");
  });

  it("parses decision records with number, status and supersedes", async () => {
    write(
      "doc-of-journey/decisions/0001-storage.md",
      "# Use SQLite\n\nDate: 2026-10-26\nStatus: accepted\n\n## Decision\n\nUse SQLite for local persistence.\n\n## Consequences\n\nSingle-file DB.\n"
    );
    write(
      "doc-of-journey/decisions/0002-change.md",
      "# Move to JSON\n\nStatus: accepted\n\n## Decision\n\nUse a JSON store instead. Supersedes 0001.\n"
    );
    const result = await discoverFromScan(tmp, parsed([
      "doc-of-journey/decisions/0001-storage.md",
      "doc-of-journey/decisions/0002-change.md",
    ]));
    const d1 = result.items.find((i) => i.adrNumber === 1);
    const d2 = result.items.find((i) => i.adrNumber === 2);
    expect(d1?.type).toBe("decision");
    expect(d1?.classification).toBe("documented-decision");
    expect(d1?.content).toContain("SQLite for local persistence");
    expect(d1?.content).toContain("Status: accepted");
    expect(d1?.startLine).toBe(8);
    expect(d1?.endLine).toBe(8);
    expect(d2?.supersedesNumber).toBe(1);
    expect(d2?.startLine).toBe(7);
    expect(d2?.endLine).toBe(7);
  });

  it("extracts procedures and dependencies from package.json with correct lines", async () => {
    const rel = write(
      "package.json",
      '{\n  "name": "demo",\n  "scripts": {\n    "test": "vitest run",\n    "lint": "eslint ."\n  },\n  "dependencies": {\n    "express": "^4.21.2"\n  }\n}\n'
    );
    const result = await discoverFromScan(tmp, parsed([rel]));
    const testProc = result.items.find((i) => i.title === "Procedure: npm run test");
    expect(testProc?.startLine).toBe(4);
    expect(testProc?.excerpt).toBe('"test": "vitest run"');
    const dep = result.items.find((i) => i.title === "Dependency: express");
    expect(dep?.startLine).toBe(8);
    expect(result.parseErrors.length).toBe(0);
  });

  it("records invalid package.json as a parse error, not a crash", async () => {
    const rel = write("package.json", "{ not json");
    const result = await discoverFromScan(tmp, parsed([rel]));
    expect(result.parseErrors.length).toBe(1);
    expect(result.items.length).toBe(0);
  });

  it("extracts status claims from status files", async () => {
    const rel = write("PROJECT_STATUS.md", "# Status\n\n- SQLite persistence — WORKING\n- Cloud sync: ROADMAP\n");
    const result = await discoverFromScan(tmp, parsed([rel]));
    const claims = result.items.filter((i) => i.classification === "status-claim");
    expect(claims.length).toBe(2);
    expect(claims[0].title).toContain("WORKING");
  });

  it("skips rule lines that contain secret-looking values", async () => {
    const rel = write("PROJECT-CORE.md", "# Core\n\n## Principles\n\n- Never commit the api key, e.g. api_key=supersecretvalue123 here.\n");
    const result = await discoverFromScan(tmp, parsed([rel]));
    expect(result.items.length).toBe(0);
  });

  it("collects open questions from TODO lines", async () => {
    const rel = write("docs/TODO-LIST.md", "# Tasks\n\n- TODO: pick a license before publishing.\n");
    const result = await discoverFromScan(tmp, parsed([rel]));
    const q = result.items.find((i) => i.classification === "open-question");
    expect(q?.content).toContain("pick a license");
  });
});

describe("buildKnowledge + store", () => {
  let projectId: string;

  beforeEach(() => {
    projectId = store.createProject(tmp, "fixture").id;
  });

  async function scanFixture(): Promise<ReturnType<typeof buildKnowledge>> {
    write("AGENTS.md", "# Agent rules\n\n## Principles\n\n- All database access must go through the repository layer in src.\n");
    write("src/repositories/user-repo.ts", "export const userRepo = {};\n");
    write("src/services/user-service.ts", "export const userService = {};\n");
    write("src/app.test.ts", "it('works', () => {});\n");
    write("vitest.config.ts", "export default {};\n");
    const knowledge = await buildKnowledge(projectId, tmp, parsed([
      "AGENTS.md",
      "src/repositories/user-repo.ts",
      "src/services/user-service.ts",
      "src/app.test.ts",
      "vitest.config.ts",
    ]));
    store.replaceDiscoveredKnowledge(projectId, knowledge);
    return knowledge;
  }

  it("creates components, evidence, and a governs edge from a rule mentioning src", async () => {
    const k = await scanFixture();
    const comp = k.nodes.find((n) => n.type === "component" && n.title === "Component: src/");
    expect(comp).toBeDefined();
    const rule = k.nodes.find((n) => n.title.includes("repository layer"));
    expect(rule).toBeDefined();
    const governs = k.edges.find((e) => e.relation === "governs");
    expect(governs?.sourceNodeId).toBe(rule?.id);
    expect(governs?.targetNodeId).toBe(comp?.id);
    expect(governs?.evidenceId).toBeTruthy();
  });

  it("creates a verified_by edge when tests exist", async () => {
    const k = await scanFixture();
    const verified = k.edges.find((e) => e.relation === "verified_by");
    const verification = k.nodes.find((n) => n.type === "verification");
    expect(verification).toBeDefined();
    expect(verified).toBeDefined();
    expect(verified?.targetNodeId).toBe(verification?.id);
  });

  it("is idempotent across rescans: stable ids, no duplicates", async () => {
    await scanFixture();
    const first = store.getNodesWithEvidence(projectId);
    await scanFixture();
    const second = store.getNodesWithEvidence(projectId);
    expect(second.length).toBe(first.length);
    expect(new Set(second.map((n) => n.node.id)).size).toBe(second.length);
  });

  it("preserves user-touched discovered nodes across rescan", async () => {
    await scanFixture();
    const before = store.getNodesWithEvidence(projectId);
    const rule = before.find((n) => n.node.title.includes("repository layer"));
    getDb().prepare("UPDATE nodes SET user_touched = 1 WHERE id = ?").run(rule?.node.id);
    await scanFixture();
    const after = store.getNodesWithEvidence(projectId);
    expect(after.find((n) => n.node.id === rule?.node.id)).toBeDefined();
  });

  it("surfaces dangling edges instead of hiding them", async () => {
    await scanFixture();
    const edges = store.getEdges(projectId);
    const nodeIds = new Set(store.getNodesWithEvidence(projectId).map((n) => n.node.id));
    const dangling = edges.filter((e) => !nodeIds.has(e.sourceNodeId) || !nodeIds.has(e.targetNodeId));
    expect(dangling.length).toBe(0);
  });
});
