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
  contentHash?: string | null;
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

export interface DiscoverySummary {
  total: number;
  byType: Partial<Record<NodeType, number>>;
}

export interface ScanResponse {
  summary: ScanSummary;
  files: SourceFileRecord[];
  discovery?: DiscoverySummary;
}

export interface NodeWithEvidence {
  node: KnowledgeNode;
  evidence: Evidence[];
}

export interface OverviewResponse {
  project: Project;
  totals: { nodes: number; evidence: number; edges: number };
  byType: Partial<Record<NodeType, number>>;
  byStatus: Partial<Record<NodeStatus, number>>;
}

export type DiffSource = "unstaged" | "staged" | "both" | "pasted";

export interface DiffChange {
  type: "add" | "del" | "normal";
  lineNumber: number | null;
  content: string;
  redacted: boolean;
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  changes: DiffChange[];
}

export interface DiffFile {
  path: string;
  oldPath: string;
  hunks: DiffHunk[];
}

export type FindingKind =
  | "prohibited-pattern"
  | "missing-verification"
  | "status-evidence-changed";

export type FindingCertainty =
  | "deterministic"
  | "strong-evidence"
  | "possible-concern"
  | "needs-human-review";

export type FindingDisposition = "open" | "accepted" | "fixed" | "dismissed";

export interface Finding {
  id: string;
  reviewRunId: string;
  ruleNodeId: string | null;
  ruleTitle: string | null;
  changedPath: string;
  changedLines: [number, number] | null;
  kind: FindingKind;
  severity: "info" | "low" | "medium" | "high";
  certainty: FindingCertainty;
  explanation: string;
  ruleEvidence: string | null;
  changedEvidence: string;
  recommendation: string;
  blocking: boolean;
  disposition: FindingDisposition;
}

export interface ReviewRun {
  id: string;
  projectId: string;
  diffSource: DiffSource;
  createdAt: string;
  filesReviewed: string[];
  checksRun: string[];
  summary: string;
  redactions: string[];
}

export interface ApplicableRule {
  ruleNodeId: string;
  title: string;
  appliesTo: string;
  evidencePointer: string;
}

export interface CheckResponse {
  run: ReviewRun;
  findings: Finding[];
  files: DiffFile[];
  applicableRules: ApplicableRule[];
}

export type MaintenanceKind = "stale" | "conflict";

export type MaintenanceFlagStatus = "open" | "resolved" | "dismissed";

export interface MaintenanceFlag {
  id: string;
  projectId: string;
  kind: MaintenanceKind;
  nodeId: string;
  nodeTitle: string;
  nodeStatus: string;
  reason: string;
  sideA: { label: string; detail: string } | null;
  sideB: { label: string; detail: string } | null;
  signature: string;
  status: MaintenanceFlagStatus;
  resolutionNote: string | null;
  createdAt: string;
}

export interface RefreshResponse {
  scannedAt: string;
  changedFiles: string[];
  discovery: DiscoverySummary;
  flags: MaintenanceFlag[];
  note: string;
}
