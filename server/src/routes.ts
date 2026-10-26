import { Router } from "express";
import fsSync from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { scanRepository } from "./scanner";
import { buildKnowledge } from "./graph";
import { reviewNode, createUserPrinciple, type ReviewAction } from "./approvals";
import { generatePack } from "./pack";
import * as store from "./store";
import type { ScanResponse, NodeType, NodeWithEvidence } from "../../shared/types";

const REVIEW_ACTIONS: ReviewAction[] = ["approve", "reject", "uncertain", "deprecate"];
const NODE_TYPES: NodeType[] = ["principle", "decision", "component", "convention", "procedure", "dependency", "verification", "status-question"];
const EDGE_RELATIONS = ["governs", "implemented_by", "depends_on", "verified_by", "supersedes", "contradicts", "related_to"] as const;

export const api = Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true });
});

api.post("/projects", (req, res) => {
  const rootPath = typeof req.body?.rootPath === "string" ? req.body.rootPath.trim() : "";
  if (!rootPath || !path.isAbsolute(rootPath)) {
    return res.status(400).json({ error: "An absolute folder path is required." });
  }
  let st;
  try {
    st = fsSync.statSync(rootPath);
  } catch {
    return res.status(400).json({ error: "Path does not exist or is not accessible." });
  }
  if (!st.isDirectory()) {
    return res.status(400).json({ error: "Path is not a folder." });
  }
  const existing = store.getProjectByRoot(rootPath);
  if (existing) return res.json({ project: existing });
  const name = path.basename(rootPath) || rootPath;
  res.status(201).json({ project: store.createProject(rootPath, name) });
});

api.post("/projects/:id/scan", async (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  try {
    const result = await scanRepository(project.rootPath);
    store.replaceSourceFiles(project.id, result.files, result.skipped);
    store.updateScanTime(project.id);

    const knowledge = await buildKnowledge(project.id, project.rootPath, result.files.map((f) => ({ relativePath: f.relativePath, size: f.size })));
    store.replaceDiscoveredKnowledge(project.id, knowledge);

    const byType: Partial<Record<NodeType, number>> = {};
    for (const n of knowledge.nodes) {
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    }

    const files = store.getSourceFiles(project.id);
    const response: ScanResponse = {
      summary: {
        parsed: result.files.length,
        skipped: result.skipped.length,
        error: result.skipped.filter((s) => s.parseStatus === "error").length,
        truncated: result.truncated,
      },
      files,
      discovery: { total: knowledge.nodes.length, byType },
    };
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: `Scan failed: ${(err as Error).message}` });
  }
});

api.get("/projects/:id/nodes", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  res.json({ nodes: store.getNodesWithEvidence(project.id), edges: store.getEdges(project.id) });
});

api.post("/projects/:id/pack/generate", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  try {
    const generated = generatePack(project);
    const record = store.savePack(project.id, { generatedAt: generated.generatedAt, content: generated.content, sourceFingerprint: generated.sourceFingerprint, format: "agents-md" });
    store.recordHistory({ id: randomUUID(), projectId: project.id, entityType: "pack", entityId: record.id, action: "generate", actor: "local-user", detail: JSON.stringify(generated.counts), at: generated.generatedAt });
    res.status(201).json({ pack: { ...record, counts: generated.counts } });
  } catch (err) {
    res.status(500).json({ error: `Pack generation failed: ${(err as Error).message}` });
  }
});

api.get("/projects/:id/pack", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const pack = store.getLatestPack(project.id);
  if (!pack) return res.json({ pack: null });
  res.json({ pack });
});

api.post("/projects/:id/pack/export", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const pack = store.getLatestPack(project.id);
  if (!pack) return res.status(409).json({ error: "Generate a pack first." });
  const body = req.body ?? {};
  const overwrite = body.overwrite === true;
  const requestedName = typeof body.filename === "string" && body.filename.trim().length > 0 ? body.filename.trim() : "AGENTS.md";
  let safeName = path.basename(requestedName).replace(/[^A-Za-z0-9._-]/g, "");
  if (safeName.length === 0) safeName = "AGENTS.md";
  if (!safeName.endsWith(".md")) safeName = `${safeName}.md`;
  const target = path.join(project.rootPath, safeName);
  if (fsSync.existsSync(target) && !overwrite) {
    return res.status(409).json({
      error: `${safeName} already exists in the repository. Confirm overwrite explicitly, or export under a different name.`,
      exists: true,
      filename: safeName,
    });
  }
  try {
    fsSync.writeFileSync(target, pack.content, "utf8");
    store.recordHistory({ id: randomUUID(), projectId: project.id, entityType: "pack", entityId: pack.id, action: "export", actor: "local-user", detail: JSON.stringify({ filename: safeName, overwrite }), at: new Date().toISOString() });
    res.json({ ok: true, writtenTo: safeName, bytes: pack.content.length });
  } catch (err) {
    res.status(500).json({ error: `Export failed: ${(err as Error).message}` });
  }
});

api.get("/projects/:id/graph/export", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const nodes = store.getNodesWithEvidence(project.id);
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project: { displayName: project.displayName, rootPath: project.rootPath },
    nodes: nodes.map((n) => n.node),
    edges: store.getEdges(project.id),
    evidence: nodes.flatMap((n) => n.evidence),
  };
  res.setHeader("Content-Disposition", `attachment; filename="carryforward-graph-${project.displayName}.json"`);
  res.json(payload);
});

api.get("/projects/:id/overview", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  res.json(store.countOverview(project.id));
});

api.post("/projects/:id/nodes", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const body = req.body ?? {};
  const title = typeof body.title === "string" ? body.title : "";
  const content = typeof body.content === "string" ? body.content : "";
  const type: NodeType = NODE_TYPES.includes(body.type) ? body.type : "principle";
  const result = createUserPrinciple(project.id, { title, content, type });
  if ("error" in result) return res.status(400).json({ error: result.error });
  res.status(201).json(result);
});

api.post("/projects/:id/nodes/:nodeId/review", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const body = req.body ?? {};
  const action = body.action;
  if (!REVIEW_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${REVIEW_ACTIONS.join(", ")}` });
  }
  const edits =
    typeof body.title === "string" || typeof body.content === "string"
      ? {
          title: typeof body.title === "string" ? body.title : undefined,
          content: typeof body.content === "string" ? body.content : undefined,
        }
      : undefined;
  const result = reviewNode(project.id, req.params.nodeId, action, edits);
  if ("error" in result) return res.status(404).json({ error: result.error });
  res.json(result);
});

api.get("/projects/:id/nodes/:nodeId", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const node = store.getNodeById(req.params.nodeId);
  if (!node || node.projectId !== project.id) return res.status(404).json({ error: "Node not found." });
  const withEvidence: NodeWithEvidence = {
    node,
    evidence: store.getNodeEvidence(node.id),
  };
  res.json({ ...withEvidence, history: store.getNodeHistory(project.id, node.id) });
});

api.post("/projects/:id/edges", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const body = req.body ?? {};
  const { sourceNodeId, targetNodeId, relation } = body;
  if (typeof sourceNodeId !== "string" || typeof targetNodeId !== "string" || !EDGE_RELATIONS.includes(relation)) {
    return res.status(400).json({ error: `sourceNodeId, targetNodeId and a relation (${EDGE_RELATIONS.join(", ")}) are required.` });
  }
  const source = store.getNodeById(sourceNodeId);
  const target = store.getNodeById(targetNodeId);
  if (!source || source.projectId !== project.id || !target || target.projectId !== project.id) {
    return res.status(404).json({ error: "Both nodes must exist in this project." });
  }
  if (sourceNodeId === targetNodeId) return res.status(400).json({ error: "Cannot link a node to itself." });
  const edge = {
    id: randomUUID(),
    projectId: project.id,
    sourceNodeId,
    targetNodeId,
    relation,
    status: "confirmed" as const,
    evidenceId: null,
    origin: "user" as const,
  };
  store.createUserEdge(project.id, edge);
  res.status(201).json({ edge });
});

api.delete("/projects/:id/edges/:edgeId", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const removed = store.deleteEdgeIfUser(project.id, req.params.edgeId);
  if (!removed) {
    return res.status(404).json({ error: "Link not found, or it is evidence-backed (only user links can be removed here)." });
  }
  res.json({ ok: true });
});

api.get("/projects/:id", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const files = store.getSourceFiles(project.id);
  res.json({
    project,
    summary: {
      parsed: files.filter((f) => f.parseStatus === "parsed").length,
      skipped: files.filter((f) => f.parseStatus === "skipped").length,
      error: files.filter((f) => f.parseStatus === "error").length,
      truncated: false,
    },
  });
});

api.get("/projects/:id/files", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  res.json({ files: store.getSourceFiles(project.id) });
});

api.delete("/projects/:id", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  store.deleteProject(project.id);
  res.json({ ok: true, note: "App index removed. Repository files were not touched." });
});
