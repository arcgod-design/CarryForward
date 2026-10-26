import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { BuiltKnowledge } from "./graph";
import type { Project, SourceFileRecord, ScannedFile, KnowledgeNode, KnowledgeEdge, Evidence, NodeType, NodeStatus, NodeWithEvidence } from "../../shared/types";

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

interface NodeRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  origin: string;
  approved_by: string | null;
  approved_at: string | null;
  supersedes: string | null;
  user_touched: number;
  created_at: string;
  updated_at: string;
}

interface EvidenceRow {
  id: string;
  project_id: string;
  node_id: string;
  source_path: string;
  start_line: number;
  end_line: number;
  excerpt: string;
  classification: string;
  observed_at: string;
  confidence: string;
}

interface EdgeRow {
  id: string;
  project_id: string;
  source_node: string;
  target_node: string;
  relation: string;
  status: string;
  evidence_id: string | null;
  origin: string;
}

function rowToNode(row: NodeRow): KnowledgeNode {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as NodeType,
    title: row.title,
    content: row.content,
    status: row.status as NodeStatus,
    origin: row.origin as KnowledgeNode["origin"],
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    supersedes: row.supersedes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    projectId: row.project_id,
    nodeId: row.node_id,
    sourcePath: row.source_path,
    startLine: row.start_line,
    endLine: row.end_line,
    excerpt: row.excerpt,
    classification: row.classification as Evidence["classification"],
    observedAt: row.observed_at,
    confidence: row.confidence as Evidence["confidence"],
  };
}

function rowToEdge(row: EdgeRow): KnowledgeEdge {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceNodeId: row.source_node,
    targetNodeId: row.target_node,
    relation: row.relation as KnowledgeEdge["relation"],
    status: row.status as KnowledgeEdge["status"],
    evidenceId: row.evidence_id,
    origin: row.origin as KnowledgeEdge["origin"],
  };
}

export function replaceDiscoveredKnowledge(projectId: string, knowledge: BuiltKnowledge): void {
  const db = getDb();
  const insertNode = db.prepare(
    "INSERT OR IGNORE INTO nodes (id, project_id, type, title, content, status, origin, approved_by, approved_at, supersedes, user_touched, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)"
  );
  const insertEvidence = db.prepare(
    "INSERT OR IGNORE INTO evidence (id, project_id, node_id, source_path, start_line, end_line, excerpt, classification, observed_at, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertEdge = db.prepare(
    "INSERT OR REPLACE INTO edges (id, project_id, source_node, target_node, relation, status, evidence_id, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const tx = db.transaction(() => {
    db.prepare(
      "DELETE FROM edges WHERE project_id = ? AND origin = 'discovered'"
    ).run(projectId);
    db.prepare(
      "DELETE FROM evidence WHERE node_id IN (SELECT id FROM nodes WHERE project_id = ? AND origin = 'discovered' AND user_touched = 0)"
    ).run(projectId);
    db.prepare(
      "DELETE FROM nodes WHERE project_id = ? AND origin = 'discovered' AND user_touched = 0"
    ).run(projectId);
    for (const n of knowledge.nodes) {
      insertNode.run(n.id, n.projectId, n.type, n.title, n.content, n.status, n.origin, n.approvedBy, n.approvedAt, n.supersedes, n.createdAt, n.updatedAt);
    }
    for (const e of knowledge.evidence) {
      insertEvidence.run(e.id, e.projectId, e.nodeId, e.sourcePath, e.startLine, e.endLine, e.excerpt, e.classification, e.observedAt, e.confidence);
    }
    for (const e of knowledge.edges) {
      insertEdge.run(e.id, e.projectId, e.sourceNodeId, e.targetNodeId, e.relation, e.status, e.evidenceId, e.origin);
    }
  });
  tx();
}

export function getNodesWithEvidence(projectId: string): NodeWithEvidence[] {
  const db = getDb();
  const nodeRows = db
    .prepare("SELECT * FROM nodes WHERE project_id = ? ORDER BY type, title")
    .all(projectId) as NodeRow[];
  const evidenceRows = db
    .prepare("SELECT * FROM evidence WHERE project_id = ? ORDER BY source_path, start_line")
    .all(projectId) as EvidenceRow[];
  const evidenceByNode = new Map<string, Evidence[]>();
  for (const row of evidenceRows) {
    const list = evidenceByNode.get(row.node_id) ?? [];
    list.push(rowToEvidence(row));
    evidenceByNode.set(row.node_id, list);
  }
  return nodeRows.map((row) => ({
    node: rowToNode(row),
    evidence: evidenceByNode.get(row.id) ?? [],
  }));
}

export function getEdges(projectId: string): KnowledgeEdge[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM edges WHERE project_id = ?")
    .all(projectId) as EdgeRow[];
  return rows.map(rowToEdge);
}

export function countOverview(projectId: string): {
  totals: { nodes: number; evidence: number; edges: number };
  byType: Partial<Record<NodeType, number>>;
  byStatus: Partial<Record<NodeStatus, number>>;
} {
  const db = getDb();
  const nodeCount = (db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE project_id = ?").get(projectId) as { c: number }).c;
  const evidenceCount = (db.prepare("SELECT COUNT(*) AS c FROM evidence WHERE project_id = ?").get(projectId) as { c: number }).c;
  const edgeCount = (db.prepare("SELECT COUNT(*) AS c FROM edges WHERE project_id = ?").get(projectId) as { c: number }).c;
  const byType: Partial<Record<NodeType, number>> = {};
  for (const row of db.prepare("SELECT type, COUNT(*) AS c FROM nodes WHERE project_id = ? GROUP BY type").all(projectId) as { type: string; c: number }[]) {
    byType[row.type as NodeType] = row.c;
  }
  const byStatus: Partial<Record<NodeStatus, number>> = {};
  for (const row of db.prepare("SELECT status, COUNT(*) AS c FROM nodes WHERE project_id = ? GROUP BY status").all(projectId) as { status: string; c: number }[]) {
    byStatus[row.status as NodeStatus] = row.c;
  }
  return { totals: { nodes: nodeCount, evidence: evidenceCount, edges: edgeCount }, byType, byStatus };
}

export interface HistoryRecord {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  detail: string;
  at: string;
}

export function getNodeById(nodeId: string): KnowledgeNode | undefined {
  const row = getDb().prepare("SELECT * FROM nodes WHERE id = ?").get(nodeId) as NodeRow | undefined;
  return row ? rowToNode(row) : undefined;
}

export function getNodeEvidence(nodeId: string): Evidence[] {
  const rows = getDb()
    .prepare("SELECT * FROM evidence WHERE node_id = ? ORDER BY source_path, start_line")
    .all(nodeId) as EvidenceRow[];
  return rows.map(rowToEvidence);
}

export function updateUserNode(
  nodeId: string,
  fields: { status?: NodeStatus; title?: string; content?: string; approvedBy?: string | null; approvedAt?: string | null }
): void {
  const db = getDb();
  const sets: string[] = ["user_touched = 1", "updated_at = ?"];
  const values: unknown[] = [new Date().toISOString()];
  if (fields.status !== undefined) {
    sets.push("status = ?");
    values.push(fields.status);
  }
  if (fields.title !== undefined) {
    sets.push("title = ?");
    values.push(fields.title);
  }
  if (fields.content !== undefined) {
    sets.push("content = ?");
    values.push(fields.content);
  }
  if (fields.approvedBy !== undefined) {
    sets.push("approved_by = ?");
    values.push(fields.approvedBy);
  }
  if (fields.approvedAt !== undefined) {
    sets.push("approved_at = ?");
    values.push(fields.approvedAt);
  }
  db.prepare(`UPDATE nodes SET ${sets.join(", ")} WHERE id = ?`).run(...values, nodeId);
}

export function createUserNode(projectId: string, node: KnowledgeNode): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO nodes (id, project_id, type, title, content, status, origin, approved_by, approved_at, supersedes, user_touched, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
  ).run(node.id, node.projectId, node.type, node.title, node.content, node.status, node.origin, node.approvedBy, node.approvedAt, node.supersedes, node.createdAt, node.updatedAt);
}

export function recordHistory(entry: HistoryRecord): void {
  getDb()
    .prepare("INSERT INTO history (id, project_id, entity_type, entity_id, action, actor, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(entry.id, entry.projectId, entry.entityType, entry.entityId, entry.action, entry.actor, entry.detail, entry.at);
}

export function getNodeHistory(projectId: string, nodeId: string): HistoryRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM history WHERE project_id = ? AND entity_type = 'node' AND entity_id = ? ORDER BY at")
    .all(projectId, nodeId) as (HistoryRecord & { project_id: string })[];
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    entityType: r.entityType,
    entityId: r.entityId,
    action: r.action,
    actor: r.actor,
    detail: r.detail,
    at: r.at,
  }));
}
