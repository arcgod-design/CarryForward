import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { Project, SourceFileRecord, ScannedFile } from "../../shared/types";

interface ProjectRow {
  id: string;
  display_name: string;
  root_path: string;
  created_at: string;
  last_scan_at: string | null;
}

interface SourceFileRow {
  id: string;
  project_id: string;
  relative_path: string;
  size: number;
  mtime: string | null;
  content_hash: string | null;
  parse_status: string;
  skip_reason: string | null;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    displayName: row.display_name,
    rootPath: row.root_path,
    createdAt: row.created_at,
    lastScanAt: row.last_scan_at,
  };
}

function rowToFile(row: SourceFileRow): SourceFileRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    relativePath: row.relative_path,
    size: row.size,
    mtime: row.mtime,
    contentHash: row.content_hash,
    parseStatus: row.parse_status as SourceFileRecord["parseStatus"],
    skipReason: row.skip_reason,
  };
}

export function createProject(rootPath: string, displayName: string): Project {
  const db = getDb();
  const project: Project = {
    id: randomUUID(),
    displayName,
    rootPath,
    createdAt: new Date().toISOString(),
    lastScanAt: null,
  };
  db.prepare(
    "INSERT INTO projects (id, display_name, root_path, created_at, last_scan_at) VALUES (@id, @displayName, @rootPath, @createdAt, @lastScanAt)"
  ).run(project);
  return project;
}

export function getProject(id: string): Project | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  return row ? rowToProject(row) : undefined;
}

export function getProjectByRoot(rootPath: string): Project | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE root_path = ?").get(rootPath) as ProjectRow | undefined;
  return row ? rowToProject(row) : undefined;
}

export function updateScanTime(id: string): void {
  getDb().prepare("UPDATE projects SET last_scan_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export function deleteProject(id: string): void {
  getDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
}

export function replaceSourceFiles(projectId: string, files: ScannedFile[], skipped: ScannedFile[]): void {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO source_files (id, project_id, relative_path, size, mtime, content_hash, parse_status, skip_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const tx = db.transaction((all: ScannedFile[]) => {
    db.prepare("DELETE FROM source_files WHERE project_id = ?").run(projectId);
    for (const f of all) {
      insert.run(
        randomUUID(),
        projectId,
        f.relativePath,
        f.size,
        f.mtime,
        f.contentHash,
        f.parseStatus,
        f.skipReason
      );
    }
  });
  tx([...files, ...skipped]);
}

export function getSourceFiles(projectId: string): SourceFileRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM source_files WHERE project_id = ? ORDER BY relative_path")
    .all(projectId) as SourceFileRow[];
  return rows.map(rowToFile);
}
