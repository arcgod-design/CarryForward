export type NodeType =
  | "principle"
  | "decision"
  | "component"
  | "convention"
  | "procedure"
  | "dependency"
  | "verification"
  | "status-question";

export type NodeStatus =
  | "candidate"
  | "user-approved"
  | "source-claim"
  | "possibly-stale"
  | "possible-conflict"
  | "superseded"
  | "rejected"
  | "uncertain";

export type Origin = "discovered" | "user";

export type EvidenceClassification =
  | "explicit-rule"
  | "documented-decision"
  | "observed-convention"
  | "inferred-candidate"
  | "status-claim"
  | "historical-note"
  | "open-question";

export type EdgeRelation =
  | "governs"
  | "implemented_by"
  | "depends_on"
  | "verified_by"
  | "supersedes"
  | "contradicts"
  | "related_to";

export interface Project {
  id: string;
  displayName: string;
  rootPath: string;
  createdAt: string;
  lastScanAt: string | null;
}

export interface ScannedFile {
  relativePath: string;
  size: number;
  mtime: string | null;
  contentHash: string | null;
  parseStatus: "parsed" | "skipped" | "error";
  skipReason: string | null;
}

export interface SourceFileRecord extends ScannedFile {
  id: string;
  projectId: string;
}

export interface Evidence {
  id: string;
  projectId: string;
  nodeId: string | null;
  sourcePath: string;
  startLine: number;
  endLine: number;
  excerpt: string;
  classification: EvidenceClassification;
  observedAt: string;
  confidence: "high" | "medium" | "low";
}

export interface KnowledgeNode {
  id: string;
  projectId: string;
  type: NodeType;
  title: string;
  content: string;
  status: NodeStatus;
  origin: Origin;
  approvedBy: string | null;
  approvedAt: string | null;
  supersedes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relation: EdgeRelation;
  status: "candidate" | "confirmed" | "stale" | "conflicted";
  evidenceId: string | null;
  origin: Origin;
}

export interface ScanSummary {
  parsed: number;
  skipped: number;
  error: number;
  truncated: boolean;
}

export interface ScanResponse {
  summary: ScanSummary;
  files: SourceFileRecord[];
}
