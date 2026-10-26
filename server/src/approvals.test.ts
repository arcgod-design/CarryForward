import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { closeDb, getDb } from "./db";
import * as store from "./store";
import { reviewNode, createUserPrinciple, LOCAL_USER } from "./approvals";
import { buildKnowledge } from "./graph";

let tmp: string;
let dbFile: string;
let projectId: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-approve-"));
  dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cf-db-")), "t.db");
  process.env.CF_DB_PATH = dbFile;
  closeDb();
  projectId = store.createProject(tmp, "fixture").id;

  fs.writeFileSync(path.join(tmp, "PROJECT-CORE.md"), "# Core\n\n## Principles\n\n- All database access must go through the repository layer.\n");
});

afterEach(() => {
  closeDb();
  delete process.env.CF_DB_PATH;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
});

async function scan(): Promise<void> {
  const knowledge = await buildKnowledge(projectId, tmp, [{ relativePath: "PROJECT-CORE.md", size: 10 }]);
  store.replaceDiscoveredKnowledge(projectId, knowledge);
}

function ruleNode() {
  return store
    .getNodesWithEvidence(projectId)
    .find((n) => n.node.title.includes("repository layer"));
}

describe("reviewNode", () => {
  it("approves a candidate with attribution and history", async () => {
    await scan();
    const rule = ruleNode();
    expect(rule?.node.status).toBe("candidate");
    const result = reviewNode(projectId, rule!.node.id, "approve");
    expect("error" in result).toBe(false);
    const approved = ("node" in result ? result.node : undefined)!;
    expect(approved.status).toBe("user-approved");
    expect(approved.approvedBy).toBe(LOCAL_USER);
    expect(approved.approvedAt).toBeTruthy();
    const history = store.getNodeHistory(projectId, rule!.node.id);
    expect(history.length).toBe(1);
    expect(history[0].action).toBe("approve");
    expect(JSON.parse(history[0].detail).to).toBe("user-approved");
  });

  it("rejects and marks uncertain", async () => {
    await scan();
    const rule = ruleNode()!;
    reviewNode(projectId, rule.node.id, "reject");
    expect(store.getNodeById(rule.node.id)?.status).toBe("rejected");
    reviewNode(projectId, rule.node.id, "uncertain");
    expect(store.getNodeById(rule.node.id)?.status).toBe("uncertain");
  });

  it("supports edit-then-approve while keeping original evidence", async () => {
    await scan();
    const rule = ruleNode()!;
    reviewNode(projectId, rule.node.id, "approve", {
      title: "Repository layer only",
      content: "All database access must go through the repository layer — no exceptions.",
    });
    const updated = store.getNodeById(rule.node.id)!;
    expect(updated.title).toBe("Repository layer only");
    expect(updated.content).toContain("no exceptions");
    const evidence = store.getNodeEvidence(rule.node.id);
    expect(evidence.length).toBe(1);
    expect(evidence[0].sourcePath).toBe("PROJECT-CORE.md");
  });

  it("approval survives a server restart (db reopen) and a rescan", async () => {
    await scan();
    const rule = ruleNode()!;
    reviewNode(projectId, rule.node.id, "approve");
    closeDb();
    expect(store.getNodeById(rule.node.id)?.status).toBe("user-approved");
    await scan();
    const after = store.getNodesWithEvidence(projectId).find((n) => n.node.id === rule.node.id);
    expect(after?.node.status).toBe("user-approved");
    expect(after?.node.approvedBy).toBe(LOCAL_USER);
  });

  it("errors on unknown nodes and invalid actions", async () => {
    await scan();
    expect("error" in reviewNode(projectId, "missing-id", "approve")).toBe(true);
    const rule = ruleNode()!;
    expect("error" in reviewNode(projectId, rule.node.id, "destroy" as never)).toBe(true);
  });

  it("never auto-upgrades a candidate: untouched discovery stays candidate", async () => {
    await scan();
    await scan();
    const rule = ruleNode()!;
    expect(rule.node.status).toBe("candidate");
    expect(getDb().prepare("SELECT user_touched FROM nodes WHERE id = ?").get(rule.node.id)).toEqual({ user_touched: 0 });
  });
});

describe("createUserPrinciple", () => {
  it("creates a user-authored approved principle with history", () => {
    const result = createUserPrinciple(projectId, {
      title: "Tests before merge",
      content: "Every change must ship with a passing test.",
      type: "principle",
    });
    expect("error" in result).toBe(false);
    const node = ("node" in result ? result.node : undefined)!;
    expect(node.origin).toBe("user");
    expect(node.status).toBe("user-approved");
    expect(node.approvedBy).toBe(LOCAL_USER);
    expect(store.getNodeHistory(projectId, node.id)[0].action).toBe("create");
  });

  it("requires title and content", () => {
    expect("error" in createUserPrinciple(projectId, { title: "", content: "x", type: "principle" })).toBe(true);
    expect("error" in createUserPrinciple(projectId, { title: "x", content: "", type: "principle" })).toBe(true);
  });

  it("user nodes survive rescan untouched", async () => {
    const created = createUserPrinciple(projectId, {
      title: "Tests before merge",
      content: "Every change must ship with a passing test.",
      type: "principle",
    });
    const node = ("node" in created ? created.node : undefined)!;
    await scan();
    expect(store.getNodeById(node.id)).toBeDefined();
  });
});
