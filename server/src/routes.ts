import { Router } from "express";
import fsSync from "fs";
import path from "path";
import { scanRepository } from "./scanner";
import { buildKnowledge } from "./graph";
import { reviewNode, createUserPrinciple, type ReviewAction } from "./approvals";
import * as store from "./store";
import type { ScanResponse, NodeType, NodeWithEvidence } from "../../shared/types";

const REVIEW_ACTIONS: ReviewAction[] = ["approve", "reject", "uncertain", "deprecate"];
const NODE_TYPES: NodeType[] = ["principle", "decision", "component", "convention", "procedure", "dependency", "verification", "status-question"];

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
