import { createHash } from "crypto";
import path from "path";
import { scanRepository } from "./scanner";
import { buildKnowledge } from "./graph";
import { currentCommit } from "./diff";
import * as store from "./store";
import type { MaintenanceFlag, NodeWithEvidence, Project, RefreshResponse } from "../../shared/types";

function sha(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

interface FlagDraft {
  kind: "stale" | "conflict";
  nodeId: string;
  nodeTitle: string;
  nodeStatus: string;
  reason: string;
  sideA: { label: string; detail: string } | null;
  sideB: { label: string; detail: string } | null;
  signature: string;
}

function detectStale(nodes: NodeWithEvidence[], latestFiles: Map<string, string | null>): FlagDraft[] {
  const drafts: FlagDraft[] = [];
  for (const { node, evidence } of nodes) {
    if (node.origin !== "discovered") continue;
    if (!node.approvedBy && node.status === "candidate") continue;
    for (const ev of evidence) {
      if (!latestFiles.has(ev.sourcePath)) {
        drafts.push({
          kind: "stale",
          nodeId: node.id,
          nodeTitle: node.title,
          nodeStatus: node.status,
          reason: `The source file ${ev.sourcePath} that supported "${node.title.slice(0, 80)}" is no longer present in the latest scan. The node is kept; its evidence may now be stale.`,
          sideA: { label: "Recorded evidence", detail: `${ev.sourcePath}:${ev.startLine} observed ${ev.observedAt} — "${ev.excerpt.slice(0, 140)}"` },
          sideB: { label: "Latest scan", detail: `${ev.sourcePath} missing from the repository` },
          signature: sha(node.id, "missing", ev.sourcePath),
        });
        break;
      } else if (ev.contentHash && latestFiles.get(ev.sourcePath) && ev.contentHash !== latestFiles.get(ev.sourcePath)) {
        drafts.push({
          kind: "stale",
          nodeId: node.id,
          nodeTitle: node.title,
          nodeStatus: node.status,
          reason: `The source file ${ev.sourcePath} changed after "${node.title.slice(0, 80)}" was recorded. The node's status was not changed — review whether the statement still holds.`,
          sideA: { label: "Recorded evidence", detail: `${ev.sourcePath}:${ev.startLine} observed ${ev.observedAt} (hash ${ev.contentHash.slice(0, 12)}) — "${ev.excerpt.slice(0, 140)}"` },
          sideB: { label: "Current file", detail: `${ev.sourcePath} hash now ${(latestFiles.get(ev.sourcePath) as string).slice(0, 12)} (content changed)` },
          signature: sha(node.id, "changed", ev.sourcePath),
        });
        break;
      }
    }
  }
  return drafts;
}

function detectSupersessionConflicts(nodes: NodeWithEvidence[]): FlagDraft[] {
  const drafts: FlagDraft[] = [];
  const decisions = nodes.filter((n) => n.node.type === "decision");
  for (const newer of decisions) {
    const supersedesTitle = /ADR (\d{4}):/i.exec(newer.node.title);
    if (!supersedesTitle) continue;
    const supMatch = /supersedes\s*(?:adr[- #]*)?(\d{1,4})/i.exec(newer.node.content);
    if (!supMatch) continue;
    const olderNum = String(Number(supMatch[1])).padStart(4, "0");
    const older = decisions.find(
      (d) => d !== newer && new RegExp(`^ADR ${olderNum}:`, "i").test(d.node.title)
    );
    if (!older) continue;
    if (/(superseded|rejected)/i.test(older.node.content)) continue;
    drafts.push({
      kind: "conflict",
      nodeId: newer.node.id,
      nodeTitle: newer.node.title,
      nodeStatus: newer.node.status,
      reason: `"${newer.node.title}" says it supersedes ADR ${olderNum}, but the older decision's recorded source status is still accepted. This is a candidate conflict, not a proven one — a decision chain is not automatically a contradiction.`,
      sideA: { label: "Newer decision", detail: `${newer.node.content.slice(0, 180)}` },
      sideB: { label: "Older decision", detail: `${older.node.title} — ${older.node.content.slice(0, 180)}` },
      signature: sha(newer.node.id, "supersedes", olderNum),
    });
  }
  return drafts;
}

export async function refreshProject(project: Project): Promise<RefreshResponse> {
  const before = store.getSourceFiles(project.id);
  const beforeByPath = new Map(before.map((f) => [f.relativePath, f]));

  const result = await scanRepository(project.rootPath);
  store.replaceSourceFiles(project.id, result.files, result.skipped);

  const knowledge = await buildKnowledge(
    project.id,
    project.rootPath,
    result.files.map((f) => ({ relativePath: f.relativePath, size: f.size, contentHash: f.contentHash }))
  );
  store.replaceDiscoveredKnowledge(project.id, knowledge);

  const latestFiles = new Map(result.files.map((f) => [f.relativePath, f.contentHash]));
  const commit = await currentCommit(project.rootPath);
  store.updateScanTime(project.id, commit);
  const changedFiles: string[] = [];
  for (const f of result.files) {
    const old = beforeByPath.get(f.relativePath);
    if (!old || old.contentHash !== f.contentHash) changedFiles.push(f.relativePath);
  }
  for (const [p, old] of beforeByPath) {
    if (old.parseStatus === "parsed" && !latestFiles.has(p)) changedFiles.push(`${p} (deleted)`);
  }

  const nodes = store.getNodesWithEvidence(project.id);
  const drafts = [...detectStale(nodes, latestFiles), ...detectSupersessionConflicts(nodes)];

  const now = new Date().toISOString();
  for (const draft of drafts) {
    store.upsertMaintenanceFlag(project.id, draft, now);
  }

  const openFlags = store.getMaintenanceFlags(project.id);

  return {
    scannedAt: now,
    changedFiles: changedFiles.slice(0, 100),
    discovery: { total: knowledge.nodes.length, byType: {} },
    flags: openFlags,
    note:
      "Refresh rescanned the repository and updated affected records. User-approved principles were preserved; stale candidates are flagged, never rewritten.",
  };
}
