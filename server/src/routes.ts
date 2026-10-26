import { Router } from "express";
import fsSync from "fs";
import path from "path";
import { scanRepository } from "./scanner";
import * as store from "./store";
import type { ScanResponse } from "../../shared/types";

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
    const files = store.getSourceFiles(project.id);
    const response: ScanResponse = {
      summary: {
        parsed: result.files.length,
        skipped: result.skipped.length,
        error: result.skipped.filter((s) => s.parseStatus === "error").length,
        truncated: result.truncated,
      },
      files,
    };
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: `Scan failed: ${(err as Error).message}` });
  }
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
