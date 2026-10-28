import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { closeDb } from "./db";
import * as store from "./store";
import { graphifyArtifactPath, runGraphify } from "./tools";
import { buildArchitectureHtml } from "./diagram";
import { buildKnowledge } from "./graph";
import type { Project } from "../../shared/types";

let tmp: string;
let dbFile: string;
let project: Project;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-tools-"));
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
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "doc-of-journey", "decisions"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "PROJECT-CORE.md"), "# Core\n\n## Principles\n\n- All database access must go through the repository layer in src.\n");
  fs.writeFileSync(path.join(tmp, "doc-of-journey/decisions/0001-layering.md"), "# Layering\n\nStatus: accepted\n\n## Decision\n\nServices depend on repositories in src.\n");
  fs.writeFileSync(path.join(tmp, "src/app.ts"), "export const x = 1;\n");
  const knowledge = await buildKnowledge(project.id, tmp, [
    { relativePath: "PROJECT-CORE.md", size: 10 },
    { relativePath: "doc-of-journey/decisions/0001-layering.md", size: 10 },
    { relativePath: "src/app.ts", size: 20 },
  ]);
  store.replaceDiscoveredKnowledge(project.id, knowledge);
}

describe("graphify integration", () => {
  it("finds an existing graphify artifact", async () => {
    await scanFixture();
    fs.mkdirSync(path.join(tmp, "graphify-out"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "graphify-out", "graph.html"), "<html>graphify graph</html>");
    expect(graphifyArtifactPath(project)).toBe(path.join(tmp, "graphify-out", "graph.html"));
  });

  it("returns null when no artifact exists", async () => {
    await scanFixture();
    expect(graphifyArtifactPath(project)).toBeNull();
  });

  it("fails honestly when the graphify CLI is missing", async () => {
    await scanFixture();
    const result = await runGraphify(project);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(20);
    } else {
      expect(fs.existsSync(path.join(tmp, "graphify-out", "graph.html"))).toBe(true);
    }
  });
});

describe("architecture diagram", () => {
  it("generates a self-contained HTML with components, SRC evidence, and attribution", async () => {
    await scanFixture();
    const nodes = store.getNodesWithEvidence(project.id);
    const html = buildArchitectureHtml(project, nodes, store.getEdges(project.id), store.getSourceFiles(project.id));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("CarryForward architecture — demo-repo");
    expect(html).toContain(">src/</text>");
    expect(html).toContain("SRC doc-of-journey/decisions/0001-layering.md:7");
    expect(html).toContain("inspired by");
    expect(html).toContain("archify");
  });

  it("escapes hostile content so repo text cannot become markup", async () => {
    fs.writeFileSync(path.join(tmp, "PROJECT-CORE.md"), '# Core\n\n## Principles\n\n- Never write <script>alert("x")</script> in production files.\n');
    const knowledge = await buildKnowledge(project.id, tmp, [{ relativePath: "PROJECT-CORE.md", size: 10 }]);
    store.replaceDiscoveredKnowledge(project.id, knowledge);
    const rule = knowledge.nodes.find((n) => n.title.includes("Never write"))!;
    const { reviewNode } = await import("./approvals");
    reviewNode(project.id, rule.id, "approve");
    const nodes = store.getNodesWithEvidence(project.id);
    const html = buildArchitectureHtml(project, nodes, store.getEdges(project.id), store.getSourceFiles(project.id));
    expect(html).not.toContain("<script>alert");
    const amp = String.fromCharCode(38);
    const escaped = (s: string) => s.replace(/&/g, amp + "amp;").replace(/</g, amp + "lt;").replace(/>/g, amp + "gt;").replace(/"/g, amp + "quot;");
    expect(html).toContain(escaped('<script>alert("x")</script> in production files.'));
  });
});
