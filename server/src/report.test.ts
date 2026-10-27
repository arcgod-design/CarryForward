import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { closeDb } from "./db";
import * as store from "./store";
import { generatePack } from "./pack";
import { buildGraphReportHtml } from "./report";
import { buildKnowledge } from "./graph";
import { currentCommit } from "./diff";
import type { Project } from "../../shared/types";

let tmp: string;
let dbFile: string;
let project: Project;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-report-"));
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

async function scanFixture(): Promise<void> {
  fs.mkdirSync(path.join(tmp, "src", "services"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "doc-of-journey", "decisions"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "PROJECT-CORE.md"), "# Core\n\n## Principles\n\n- All database access must go through the repository layer in src.\n");
  fs.writeFileSync(path.join(tmp, "SESSION-STATE.md"), "# State\n\n- SQLite persistence — WORKING\n");
  fs.writeFileSync(path.join(tmp, "doc-of-journey/decisions/0001-layering.md"), "# Layering\n\nStatus: accepted\n\n## Decision\n\nServices depend on repositories in src.\n");
  fs.writeFileSync(path.join(tmp, "src/services/user-service.ts"), "export const userService = {};\n");
  const knowledge = await buildKnowledge(project.id, tmp, [
    { relativePath: "PROJECT-CORE.md", size: 10 },
    { relativePath: "SESSION-STATE.md", size: 10 },
    { relativePath: "doc-of-journey/decisions/0001-layering.md", size: 10 },
    { relativePath: "src/services/user-service.ts", size: 10 },
  ]);
  store.replaceDiscoveredKnowledge(project.id, knowledge);
}

describe("pack knowledge-structure section", () => {
  it("describes the repository's working structure grouped by file role", async () => {
    await scanFixture();
    const pack = generatePack(project);
    expect(pack.content).toContain("## Repository knowledge structure");
    expect(pack.content).toContain("### Project core / locked decisions");
    expect(pack.content).toContain("- PROJECT-CORE.md");
    expect(pack.content).toContain("### Status and task records");
    expect(pack.content).toContain("- SESSION-STATE.md");
    expect(pack.content).toContain("### Decision records (ADRs)");
    expect(pack.content).toContain("- doc-of-journey/decisions/0001-layering.md");
    expect(pack.content).toContain("the source files are authoritative");
  });

  it("includes the pinned commit when the project has one", async () => {
    await scanFixture();
    store.updateScanTime(project.id, "abc123def456789abc123def456789abc123def4");
    const pack = generatePack(store.getProject(project.id)!);
    expect(pack.content).toContain("Evidence captured at commit: abc123def456");
    const again = generatePack(store.getProject(project.id)!);
    expect(again.content).toBe(pack.content);
  });

  it("omits the structure section when no role-bearing files exist", () => {
    const pack = generatePack(project);
    expect(pack.content).not.toContain("## Repository knowledge structure");
  });
});

describe("commit pinning", () => {
  it("records a commit hash for git repositories and null otherwise", async () => {
    expect(await currentCommit(tmp)).toBeNull();
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const exec = promisify(execFile);
    await exec("git", ["-C", tmp, "init"]);
    await exec("git", ["-C", tmp, "config", "user.email", "t@t"]);
    await exec("git", ["-C", tmp, "config", "user.name", "t"]);
    fs.writeFileSync(path.join(tmp, "a.txt"), "x");
    await exec("git", ["-C", tmp, "add", "-A"]);
    await exec("git", ["-C", tmp, "commit", "-m", "init"]);
    const commit = await currentCommit(tmp);
    expect(commit).toMatch(/^[0-9a-f]{40}$/i);
  });
});

describe("standalone graph report", () => {
  it("generates a self-contained HTML artifact with embedded data", async () => {
    await scanFixture();
    const nodes = store.getNodesWithEvidence(project.id);
    const html = buildGraphReportHtml(project, nodes, store.getEdges(project.id), store.getSourceFiles(project.id));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("CarryForward graph — demo-repo");
    expect(html).toContain('type="application/json"');
    expect(html).toContain("PROJECT-CORE.md");
    expect(html).toContain("cytoscape");
    const jsonStart = html.indexOf('type="application/json">') + 'type="application/json">'.length;
    const jsonEnd = html.indexOf("</script>", jsonStart);
    const jsonBlock = html.slice(jsonStart, jsonEnd);
    expect(jsonBlock).not.toContain("</script>");
    expect(jsonBlock).not.toContain("<");
    const payload = JSON.parse(jsonBlock);
    expect(payload.nodes.length).toBeGreaterThan(0);
    expect(payload.edges.length).toBeGreaterThan(0);
  });

  it("embeds the commit pin in the report header", async () => {
    await scanFixture();
    store.updateScanTime(project.id, "abc123def456789abc123def456789abc123def4");
    const nodes = store.getNodesWithEvidence(project.id);
    const html = buildGraphReportHtml(store.getProject(project.id)!, nodes, store.getEdges(project.id), store.getSourceFiles(project.id));
    expect(html).toContain("captured at commit abc123def456");
  });
});
