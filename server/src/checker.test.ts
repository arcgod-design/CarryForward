import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { closeDb } from "./db";
import * as store from "./store";
import { reviewNode } from "./approvals";
import { runChecks } from "./checker";
import { parseDiffText } from "./diff";
import { buildKnowledge } from "./graph";
import type { Project } from "../../shared/types";

let tmp: string;
let dbFile: string;
let project: Project;

const VIOLATING_DIFF = [
  "diff --git a/src/services/user-service.ts b/src/services/user-service.ts",
  "index 111..222 100644",
  "--- a/src/services/user-service.ts",
  "+++ b/src/services/user-service.ts",
  "@@ -1,2 +1,4 @@",
  " import { userRepo } from '../repositories/user-repo';",
  "+const rows = db.query('SELECT * FROM users');",
  "+const KEY = 'ghp_abcdefghijklmnopqrstuvwx';",
  "",
].join("\n");

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-check-"));
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

async function fixtureWithRule(): Promise<string> {
  fs.mkdirSync(path.join(tmp, "src", "repositories"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "AGENTS.md"),
    "# Rules\n\n## Principles\n\n- All database access must go through the repository layer.\n"
  );
  fs.writeFileSync(path.join(tmp, "src/repositories/user-repo.ts"), "export const userRepo = {};\n");
  const knowledge = await buildKnowledge(project.id, tmp, [
    { relativePath: "AGENTS.md", size: 10 },
    { relativePath: "src/repositories/user-repo.ts", size: 10 },
  ]);
  store.replaceDiscoveredKnowledge(project.id, knowledge);
  const discoveredRule = knowledge.nodes.find((n) => n.title.includes("repository layer"))!;
  reviewNode(project.id, discoveredRule.id, "approve", {
    content: "All database access must go through the repository layer.\nForbidden pattern: \\bquery\\s*\\( in src/services",
  });
  return discoveredRule.id;
}

describe("parseDiffText", () => {
  it("parses files and hunks, redacts secrets, keeps line numbers", () => {
    const { files, redactions } = parseDiffText(VIOLATING_DIFF);
    expect(files.length).toBe(1);
    expect(files[0].path).toBe("src/services/user-service.ts");
    const adds = files[0].hunks[0].changes.filter((c) => c.type === "add");
    expect(adds.length).toBe(2);
    expect(adds[0].lineNumber).toBe(2);
    expect(redactions.length).toBeGreaterThan(0);
    const keyLine = adds[1].content;
    expect(keyLine).toContain("[REDACTED:");
    expect(keyLine).not.toContain("ghp_abcdefghijklmnopqrstuvwx");
  });

  it("returns empty for empty diff text", () => {
    expect(parseDiffText("")).toEqual({ files: [], redactions: [] });
  });
});

describe("runChecks", () => {
  it("flags a violating diff against an approved rule with a user-encoded pattern — deterministic, both sides cited", async () => {
    const ruleId = await fixtureWithRule();
    const { files } = parseDiffText(VIOLATING_DIFF);
    const result = runChecks(project, files);

    const finding = result.findings.find((f) => f.kind === "prohibited-pattern");
    expect(finding).toBeDefined();
    expect(finding?.certainty).toBe("deterministic");
    expect(finding?.ruleNodeId).toBe(ruleId);
    expect(finding?.ruleEvidence).toContain("AGENTS.md:5");
    expect(finding?.changedEvidence).toContain("src/services/user-service.ts:2");
    expect(finding?.changedEvidence).toContain("db.query");
    expect(finding?.blocking).toBe(true);
    expect(finding?.severity).toBe("high");
    expect(finding?.recommendation.length).toBeGreaterThan(10);
  });

  it("does not flag the same pattern outside its scope", async () => {
    await fixtureWithRule();
    const outsideDiff = VIOLATING_DIFF.replace(/src\/services\/user-service\.ts/g, "src/repositories/user-repo.ts");
    const { files } = parseDiffText(outsideDiff);
    const result = runChecks(project, files);
    expect(result.findings.find((f) => f.kind === "prohibited-pattern")).toBeUndefined();
  });

  it("finds nothing on a compliant diff and reports scoped checks", async () => {
    await fixtureWithRule();
    const cleanDiff = [
      "diff --git a/src/services/user-service.ts b/src/services/user-service.ts",
      "index 111..222 100644",
      "--- a/src/services/user-service.ts",
      "+++ b/src/services/user-service.ts",
      "@@ -1,2 +1,3 @@",
      " import { userRepo } from '../repositories/user-repo';",
      "+const users = userRepo.list();",
      "",
    ].join("\n");
    const { files } = parseDiffText(cleanDiff);
    const result = runChecks(project, files);
    expect(result.findings.filter((f) => f.disposition === "open").length).toBe(0);
    expect(result.checksRun.length).toBe(3);
    expect(result.checksRun[0]).toContain("prohibited-pattern checks (1");
  });

  it("unapproved candidates never produce findings", async () => {
    fs.mkdirSync(path.join(tmp, "src", "services"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "AGENTS.md"),
      "# Rules\n\n## Principles\n\n- All database access must go through the repository layer.\nForbidden pattern: \\bquery\\s*\\( in src/services\n"
    );
    const knowledge = await buildKnowledge(project.id, tmp, [{ relativePath: "AGENTS.md", size: 10 }]);
    store.replaceDiscoveredKnowledge(project.id, knowledge);
    const { files } = parseDiffText(VIOLATING_DIFF);
    const result = runChecks(project, files);
    expect(result.findings.find((f) => f.kind === "prohibited-pattern")).toBeUndefined();
  });

  it("flags missing tests when an approved test-requiring rule exists", async () => {
    const { createUserPrinciple } = await import("./approvals");
    const created = createUserPrinciple(project.id, {
      title: "Tests with every change",
      content: "Every change must include a test.",
      type: "convention",
    });
    expect("error" in created).toBe(false);
    const { files } = parseDiffText(VIOLATING_DIFF.replace(/src\/services\/user-service\.ts/g, "src/core.ts"));
    const result = runChecks(project, files);
    const missing = result.findings.find((f) => f.kind === "missing-verification");
    expect(missing).toBeDefined();
    expect(missing?.certainty).toBe("strong-evidence");
    expect(missing?.blocking).toBe(false);
  });

  it("review runs persist with findings and dispositions update", async () => {
    await fixtureWithRule();
    const { files } = parseDiffText(VIOLATING_DIFF);
    const result = runChecks(project, files);
    const run = {
      id: result.findings[0]?.reviewRunId ?? "run-1",
      projectId: project.id,
      diffSource: "pasted" as const,
      createdAt: new Date().toISOString(),
      filesReviewed: files.map((f) => f.path),
      checksRun: result.checksRun,
      summary: "test",
      redactions: [],
    };
    store.saveReviewRun(project.id, run, result.findings);
    const loaded = store.getLatestReviewRun(project.id);
    expect(loaded?.findings.length).toBe(result.findings.length);
    const target = loaded!.findings[0];
    expect(store.updateFindingDisposition(project.id, target.id, "fixed")).toBe(true);
    expect(store.getLatestReviewRun(project.id)?.findings[0].disposition).toBe("fixed");
    closeDb();
    expect(store.getLatestReviewRun(project.id)?.findings[0].disposition).toBe("fixed");
  });
});
