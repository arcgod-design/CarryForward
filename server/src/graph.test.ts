import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { closeDb } from "./db";
import * as store from "./store";
import { buildKnowledge } from "./graph";
import type { KnowledgeEdge } from "../../shared/types";

let tmp: string;
let dbFile: string;
let projectId: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-graph-"));
  dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cf-db-")), "t.db");
  process.env.CF_DB_PATH = dbFile;
  closeDb();
  projectId = store.createProject(tmp, "fixture").id;
});

afterEach(() => {
  closeDb();
  delete process.env.CF_DB_PATH;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
});

async function buildFixture(): Promise<{ ruleId: string; compId: string; decisionId: string }> {
  fs.mkdirSync(path.join(tmp, "src", "repositories"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "doc-of-journey/decisions"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# Rules\n\n## Principles\n\n- All database access must go through the repository layer in src.\n");
  fs.writeFileSync(path.join(tmp, "src/repositories/user-repo.ts"), "export const userRepo = {};\n");
  fs.writeFileSync(path.join(tmp, "doc-of-journey/decisions/0001-layering.md"), "# Layering\n\nStatus: accepted\n\n## Decision\n\nServices depend on repositories in src.\n");
  const knowledge = await buildKnowledge(projectId, tmp, [
    { relativePath: "AGENTS.md", size: 10 },
    { relativePath: "src/repositories/user-repo.ts", size: 10 },
    { relativePath: "doc-of-journey/decisions/0001-layering.md", size: 10 },
  ]);
  store.replaceDiscoveredKnowledge(projectId, knowledge);
  const rule = knowledge.nodes.find((n) => n.title.includes("repository layer"))!;
  const comp = knowledge.nodes.find((n) => n.type === "component")!;
  const decision = knowledge.nodes.find((n) => n.type === "decision")!;
  return { ruleId: rule.id, compId: comp.id, decisionId: decision.id };
}

describe("graph edges", () => {
  it("every discovered edge is evidence-backed or user-origin", async () => {
    await buildFixture();
    const edges = store.getEdges(projectId);
    expect(edges.length).toBeGreaterThan(0);
    const evidenceIds = new Set(store.getNodesWithEvidence(projectId).flatMap((n) => n.evidence.map((e) => e.id)));
    for (const e of edges) {
      const justified = e.evidenceId !== null ? evidenceIds.has(e.evidenceId) : false;
      expect(justified || e.origin === "user").toBe(true);
    }
  });

  it("user can create and remove links; discovered links are protected", async () => {
    const { ruleId, decisionId } = await buildFixture();
    const edge: KnowledgeEdge = {
      id: "user-edge-1",
      projectId,
      sourceNodeId: ruleId,
      targetNodeId: decisionId,
      relation: "related_to",
      status: "confirmed",
      evidenceId: null,
      origin: "user",
    };
    store.createUserEdge(projectId, edge);
    const edges = store.getEdges(projectId);
    expect(edges.find((e) => e.id === "user-edge-1")).toBeDefined();

    const discovered = edges.find((e) => e.origin === "discovered")!;
    expect(store.deleteEdgeIfUser(projectId, discovered.id)).toBe(false);
    expect(store.deleteEdgeIfUser(projectId, "user-edge-1")).toBe(true);
    expect(store.getEdges(projectId).find((e) => e.id === "user-edge-1")).toBeUndefined();
  });

  it("walking edges from a rule reaches its governed component", async () => {
    const { ruleId, compId } = await buildFixture();
    const edges = store.getEdges(projectId);
    const step = edges.find((e) => e.sourceNodeId === ruleId && e.relation === "governs");
    expect(step?.targetNodeId).toBe(compId);
  });
});
