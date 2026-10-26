import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { closeDb, migrationCount } from "./db";
import * as store from "./store";
import { reviewNode, createUserPrinciple } from "./approvals";
import { generatePack } from "./pack";
import { buildKnowledge } from "./graph";
import type { Project } from "../../shared/types";

let tmp: string;
let dbFile: string;
let project: Project;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-pack-"));
  dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cf-db-")), "t.db");
  process.env.CF_DB_PATH = dbFile;
  closeDb();
  project = store.createProject(tmp, "demo-repo");
  expect(migrationCount()).toBeGreaterThanOrEqual(4);
});

afterEach(() => {
  closeDb();
  delete process.env.CF_DB_PATH;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
});

async function scanFixture(): Promise<{ ruleId: string }> {
  fs.writeFileSync(
    path.join(tmp, "PROJECT-CORE.md"),
    "# Core\n\n## Principles\n\n- All database access must go through the repository layer.\n- Contact email: api_key=supersecretvalue123 must never appear.\n"
  );
  fs.writeFileSync(
    path.join(tmp, "package.json"),
    '{\n  "name": "demo-repo",\n  "scripts": { "test": "vitest run" },\n  "dependencies": { "express": "^4.21.2" }\n}\n'
  );
  const knowledge = await buildKnowledge(project.id, tmp, [
    { relativePath: "PROJECT-CORE.md", size: 10 },
    { relativePath: "package.json", size: 10 },
  ]);
  store.replaceDiscoveredKnowledge(project.id, knowledge);
  const rule = knowledge.nodes.find((n) => n.title.includes("repository layer"))!;
  return { ruleId: rule.id };
}

describe("generatePack", () => {
  it("includes approved rules with source pointers, excludes untouched candidates from binding sections", async () => {
    const { ruleId } = await scanFixture();
    const before = generatePack(project);
    expect(before.content).toContain("No principles have been user-approved yet");

    reviewNode(project.id, ruleId, "approve");
    const after = generatePack(project);
    expect(after.content).toContain("All database access must go through the repository layer.");
    expect(after.content).toContain("PROJECT-CORE.md:5");
    expect(after.counts.approvedRules).toBe(1);
    expect(after.content).toContain("machine-discovered candidate");
  });

  it("is deterministic: same graph state produces identical content", async () => {
    const { ruleId } = await scanFixture();
    reviewNode(project.id, ruleId, "approve");
    const a = generatePack(project);
    const b = generatePack(project);
    expect(a.content).toBe(b.content);
    expect(a.sourceFingerprint).toBe(b.sourceFingerprint);
  });

  it("excludes secret-bearing content from the pack", async () => {
    await scanFixture();
    const secret = createUserPrinciple(project.id, {
      title: "Contact rule",
      content: "api_key=supersecretvalue123 must never be committed",
      type: "principle",
    });
    expect("error" in secret).toBe(false);
    const pack = generatePack(project);
    expect(pack.content).not.toContain("supersecretvalue123");
  });

  it("lists procedures and dependencies from discovery", async () => {
    await scanFixture();
    const pack = generatePack(project);
    expect(pack.content).toContain("npm run test");
    expect(pack.content).toContain("express ^4.21.2");
  });

  it("pack persists in the store across reopen", async () => {
    const generated = generatePack(project);
    const saved = store.savePack(project.id, { generatedAt: generated.generatedAt, content: generated.content, sourceFingerprint: generated.sourceFingerprint, format: "agents-md" });
    closeDb();
    const loaded = store.getLatestPack(project.id);
    expect(loaded?.id).toBe(saved.id);
    expect(loaded?.content).toBe(generated.content);
  });
});
