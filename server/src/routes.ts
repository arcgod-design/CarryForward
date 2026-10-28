import { Router } from "express";
import fsSync from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { scanRepository } from "./scanner";
import { buildKnowledge } from "./graph";
import { reviewNode, createUserPrinciple, type ReviewAction } from "./approvals";
import { generatePack } from "./pack";
import { buildGraphReportHtml } from "./report";
import { buildArchitectureHtml } from "./diagram";
import { graphifyArtifactPath, runGraphify } from "./tools";
import { captureGitDiff, parseDiffText, currentCommit } from "./diff";
import { runChecks } from "./checker";
import { refreshProject } from "./maintenance";
import { startWatch, stopWatch, watchStatus } from "./watcher";
import * as store from "./store";
import type { CheckResponse, DiffSource, ScanResponse, NodeType, NodeWithEvidence, ReviewRun, Finding, MaintenanceFlag } from "../../shared/types";

const REVIEW_ACTIONS: ReviewAction[] = ["approve", "reject", "uncertain", "deprecate"];
const NODE_TYPES: NodeType[] = ["principle", "decision", "component", "convention", "procedure", "dependency", "verification", "status-question"];
const EDGE_RELATIONS = ["governs", "implemented_by", "depends_on", "verified_by", "supersedes", "contradicts", "related_to"] as const;
const DIFF_SOURCES: DiffSource[] = ["unstaged", "staged", "both", "pasted"];

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
    const commit = await currentCommit(project.rootPath);
    store.updateScanTime(project.id, commit);

    const knowledge = await buildKnowledge(project.id, project.rootPath, result.files.map((f) => ({ relativePath: f.relativePath, size: f.size, contentHash: f.contentHash })));
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

api.post("/projects/:id/check", async (req, res) => {
  try {
    const project = store.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    const body = req.body ?? {};
    const source: DiffSource = DIFF_SOURCES.includes(body.source) ? body.source : "unstaged";

    let diffText = "";
    if (source === "pasted") {
      diffText = typeof body.pasted === "string" ? body.pasted : "";
      if (diffText.trim().length === 0) return res.status(400).json({ error: "Paste a unified diff to check." });
    } else {
      try {
        diffText = await captureGitDiff(project.rootPath, source);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        const reason =
          e.code === "ENOENT"
            ? "git is not installed or not on PATH."
            : /not a git repository/i.test(String(e.message))
              ? "the opened folder is not a git repository."
              : `git diff failed (${e.message || e.code || "unknown error"}).`;
        return res.status(400).json({ error: `Could not read the diff: ${reason} You can paste a diff instead.` });
      }
    }

    const { files, redactions } = parseDiffText(diffText);
    const check = runChecks(project, files);
    const run: ReviewRun = {
      id: randomUUID(),
      projectId: project.id,
      diffSource: source,
      createdAt: new Date().toISOString(),
      filesReviewed: files.map((f) => f.path),
      checksRun: check.checksRun,
      redactions,
      summary:
        files.length === 0
          ? "No changes found in the selected diff source."
          : `${check.findings.length} finding${check.findings.length === 1 ? "" : "s"} across ${files.length} changed file${files.length === 1 ? "" : "s"}.`,
    };
    store.saveReviewRun(project.id, run, check.findings);
    store.recordHistory({
      id: randomUUID(),
      projectId: project.id,
      entityType: "review_run",
      entityId: run.id,
      action: "check",
      actor: "local-user",
      detail: JSON.stringify({ source, findings: check.findings.length }),
      at: run.createdAt,
    });
    const response: CheckResponse = {
      run,
      findings: check.findings,
      files,
      applicableRules: check.applicableRules,
    };
    res.json(response);
  } catch (err) {
    console.error("check route failed:", err);
    res.status(500).json({ error: `Change check failed: ${(err as Error).message}` });
  }
});

api.get("/projects/:id/check", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const latest = store.getLatestReviewRun(project.id);
  res.json(latest ?? { run: null, findings: [] });
});

api.post("/projects/:id/findings/:findingId/disposition", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const disposition = req.body?.disposition;
  if (!["accepted", "fixed", "dismissed"].includes(disposition)) {
    return res.status(400).json({ error: "disposition must be accepted, fixed, or dismissed." });
  }
  const ok = store.updateFindingDisposition(project.id, req.params.findingId, disposition);
  if (!ok) return res.status(404).json({ error: "Finding not found." });
  res.json({ ok: true });
});

api.post("/projects/:id/refresh", async (req, res) => {
  try {
    const project = store.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found." });
    const result = await refreshProject(project);
    res.json(result);
  } catch (err) {
    console.error("refresh route failed:", err);
    res.status(500).json({ error: `Refresh failed: ${(err as Error).message}` });
  }
});

api.get("/projects/:id/maintenance", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const flags: MaintenanceFlag[] = store.getMaintenanceFlags(project.id).map((f) => ({
    id: f.id,
    projectId: f.projectId,
    kind: f.kind,
    nodeId: f.nodeId,
    nodeTitle: f.nodeTitle,
    nodeStatus: f.nodeStatus,
    reason: f.reason,
    sideA: f.sideA,
    sideB: f.sideB,
    signature: f.signature,
    status: f.status,
    resolutionNote: f.resolutionNote,
    createdAt: f.createdAt,
  }));
  res.json({ flags, watch: watchStatus(project.id), lastScanAt: project.lastScanAt });
});

api.post("/projects/:id/maintenance/:flagId/resolve", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const status = req.body?.status;
  if (!["resolved", "dismissed"].includes(status)) {
    return res.status(400).json({ error: "status must be resolved or dismissed." });
  }
  const note = typeof req.body?.note === "string" ? req.body.note : null;
  const ok = store.resolveMaintenanceFlag(project.id, req.params.flagId, status, note);
  if (!ok) return res.status(404).json({ error: "Open flag not found." });
  res.json({ ok: true });
});

api.post("/projects/:id/watch/start", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const result = startWatch(project);
  res.json(result);
});

api.post("/projects/:id/watch/stop", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  stopWatch(project.id);
  res.json({ stopped: true });
});

api.get("/projects/:id/codegraph", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const artifact = graphifyArtifactPath(project);
  if (!artifact) {
    return res.status(404).json({
      error: "No graphify output found in this repository (expected graphify-out/graph.html).",
      howTo: [
        "uv tool install graphifyy   # graphify CLI (open source, Apache-2.0/MIT)",
        "graphify install            # register the skill (optional)",
        "Then press Generate here — CarryForward runs 'graphify .' inside the repository.",
      ],
    });
  }
  res.type("html").send(fsSync.readFileSync(artifact));
});

api.post("/projects/:id/codegraph/generate", async (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const result = await runGraphify(project);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true, note: "graphify regenerated graphify-out/graph.html. Attributed: powered by graphify (open source, Apache-2.0/MIT)." });
});

api.get("/projects/:id/diagram/architecture", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const nodes = store.getNodesWithEvidence(project.id);
  if (nodes.length === 0) return res.status(409).json({ error: "Scan the project first — there is nothing to diagram yet." });
  const html = buildArchitectureHtml(project, nodes, store.getEdges(project.id), store.getSourceFiles(project.id));
  res.setHeader("Content-Disposition", `inline; filename="carryforward-architecture-${project.displayName}.html"`);
  res.type("html").send(html);
});

api.get("/projects/:id/graph/report", (req, res) => {
  const project = store.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const nodes = store.getNodesWithEvidence(project.id);
  if (nodes.length === 0) return res.status(409).json({ error: "Scan the project first — there is no graph to report yet." });
  const html = buildGraphReportHtml(project, nodes, store.getEdges(project.id), store.getSourceFiles(project.id));
  res.setHeader("Content-Disposition", `attachment; filename="carryforward-graph-${project.displayName}.html"`);
  res.type("html").send(html);
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
