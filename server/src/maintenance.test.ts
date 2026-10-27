import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { closeDb } from "./db";
import * as store from "./store";
import { reviewNode } from "./approvals";
import { refreshProject } from "./maintenance";
import type { Project } from "../../shared/types";

let tmp: string;
let dbFile: string;
let project: Project;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-maint-"));
  dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cf-db-")), "t.db");
  process.env.CF_DB_PATH = dbFile;
  closeDb();
  project = store.createProject(tmp, "demo-repo");
});

afterEach(() => {
  closeDb();
  delete process.env.CF_DB_PATH;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
});

function writeCore(content: string): void {
  fs.writeFileSync(path.join(tmp, "PROJECT-CORE.md"), content);
}

const CORE_V1 = "# Core\n\n## Principles\n\n- All database access must go through the repository layer.\n";
const CORE_V2 = "# Core\n\n## Principles\n\n- All database access must go through the repository layer via the new interface.\n";

async function initialScan(): Promise<string> {
  writeCore(CORE_V1);
  const { scanRepository } = await import("./scanner");
  const { buildKnowledge } = await import("./graph");
  const scan = await scanRepository(project.rootPath);
  store.replaceSourceFiles(project.id, scan.files, scan.skipped);
  const knowledge = await buildKnowledge(project.id, project.rootPath, scan.files.map((f) => ({ relativePath: f.relativePath, size: f.size, contentHash: f.contentHash })));
  store.replaceDiscoveredKnowledge(project.id, knowledge);
  const rule = knowledge.nodes.find((n) => n.title.includes("repository layer"))!;
  return rule.id;
}

describe("maintenance refresh", () => {
  it("flags stale when an approved rule's source file is deleted, without touching the approval", async () => {
    const ruleId = await initialScan();
    reviewNode(project.id, ruleId, "approve");

    fs.rmSync(path.join(tmp, "PROJECT-CORE.md"));
    const result = await refreshProject(project);

    const flag = result.flags.find((f) => f.kind === "stale" && f.status === "open" && f.nodeId === ruleId);
    expect(flag).toBeDefined();
    expect(flag!.reason).toContain("no longer present");
    expect(flag!.sideA?.label).toBe("Recorded evidence");
    expect(flag!.sideB?.detail).toContain("missing");

    const rule = store.getNodeById(ruleId);
    expect(rule?.status).toBe("user-approved");
    expect(rule?.approvedBy).toBe("local-user");
  });

  it("flags stale when the source file content changes after approval", async () => {
    const ruleId = await initialScan();
    reviewNode(project.id, ruleId, "approve");
    writeCore(CORE_V2);

    const result = await refreshProject(project);
    const flag = result.flags.find((f) => f.kind === "stale" && f.status === "open" && f.nodeId === ruleId);
    expect(flag).toBeDefined();
    expect(flag!.reason).toContain("changed after");
    expect(store.getNodeById(ruleId)?.status).toBe("user-approved");
  });

  it("reports changed files in the refresh response", async () => {
    await initialScan();
    writeCore(CORE_V2);
    const result = await refreshProject(project);
    expect(result.changedFiles).toContain("PROJECT-CORE.md");
  });

  it("keeps a dismissed flag dismissed while the same condition persists", async () => {
    const ruleId = await initialScan();
    reviewNode(project.id, ruleId, "approve");
    fs.rmSync(path.join(tmp, "PROJECT-CORE.md"));
    const first = await refreshProject(project);
    const flag = first.flags.find((f) => f.nodeId === ruleId && f.kind === "stale")!;
    expect(store.resolveMaintenanceFlag(project.id, flag.id, "dismissed", "file removed on purpose")).toBe(true);

    const second = await refreshProject(project);
    const refetch = second.flags.find((f) => f.id === flag.id);
    expect(refetch?.status).toBe("dismissed");
    expect(second.flags.filter((f) => f.kind === "stale" && f.status === "open" && f.nodeId === ruleId).length).toBe(0);
  });

  it("detects a supersession conflict between two decision records and shows both sides", async () => {
    fs.mkdirSync(path.join(tmp, "doc-of-journey", "decisions"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "doc-of-journey", "decisions", "0001-layering.md"),
      "# Layering\n\nStatus: accepted\n\n## Decision\n\nServices depend on repositories in src.\n"
    );
    fs.writeFileSync(
      path.join(tmp, "doc-of-journey", "decisions", "0002-new-layering.md"),
      "# New layering\n\nStatus: accepted\n\n## Decision\n\nServices call an API gateway instead. Supersedes 0001.\n"
    );
    const { scanRepository } = await import("./scanner");
    const { buildKnowledge } = await import("./graph");
    const scan = await scanRepository(project.rootPath);
    store.replaceSourceFiles(project.id, scan.files, scan.skipped);
    const knowledge = await buildKnowledge(project.id, project.rootPath, scan.files.map((f) => ({ relativePath: f.relativePath, size: f.size, contentHash: f.contentHash })));
    store.replaceDiscoveredKnowledge(project.id, knowledge);

    const result = await refreshProject(project);
    const conflict = result.flags.find((f) => f.kind === "conflict" && f.status === "open");
    expect(conflict).toBeDefined();
    expect(conflict!.reason).toContain("not automatically a contradiction");
    expect(conflict!.sideA?.detail).toContain("API gateway");
    expect(conflict!.sideB?.detail).toContain("ADR 0001");
  });
});
