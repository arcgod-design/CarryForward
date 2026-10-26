import { randomUUID } from "crypto";
import * as store from "./store";
import type { KnowledgeNode, NodeStatus, NodeType } from "../../shared/types";

export const LOCAL_USER = "local-user";

export type ReviewAction = "approve" | "reject" | "uncertain" | "deprecate";

const ACTION_STATUS: Record<ReviewAction, NodeStatus> = {
  approve: "user-approved",
  reject: "rejected",
  uncertain: "uncertain",
  deprecate: "superseded",
};

export interface ReviewEdits {
  title?: string;
  content?: string;
}

export function reviewNode(
  projectId: string,
  nodeId: string,
  action: ReviewAction,
  edits?: ReviewEdits
): { node: KnowledgeNode } | { error: string } {
  if (!(action in ACTION_STATUS)) return { error: `Unknown action: ${String(action)}` };
  const existing = store.getNodeById(nodeId);
  if (!existing || existing.projectId !== projectId) return { error: "Node not found in this project." };

  const now = new Date().toISOString();
  const newStatus = ACTION_STATUS[action];
  const fields: Parameters<typeof store.updateUserNode>[1] = { status: newStatus };
  if (action === "approve") {
    fields.approvedBy = LOCAL_USER;
    fields.approvedAt = now;
  }
  if (edits?.title !== undefined && edits.title.trim().length > 0) fields.title = edits.title.trim();
  if (edits?.content !== undefined && edits.content.trim().length > 0) fields.content = edits.content.trim();

  store.updateUserNode(nodeId, fields);
  store.recordHistory({
    id: randomUUID(),
    projectId,
    entityType: "node",
    entityId: nodeId,
    action,
    actor: LOCAL_USER,
    detail: JSON.stringify({
      from: existing.status,
      to: newStatus,
      editsApplied: edits !== undefined,
    }),
    at: now,
  });

  const updated = store.getNodeById(nodeId);
  if (!updated) return { error: "Update failed." };
  return { node: updated };
}

export function createUserPrinciple(
  projectId: string,
  input: { title: string; content: string; type: NodeType }
): { node: KnowledgeNode } | { error: string } {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) return { error: "Title and content are required." };
  const now = new Date().toISOString();
  const node: KnowledgeNode = {
    id: randomUUID(),
    projectId,
    type: input.type,
    title,
    content,
    status: "user-approved",
    origin: "user",
    approvedBy: LOCAL_USER,
    approvedAt: now,
    supersedes: null,
    createdAt: now,
    updatedAt: now,
  };
  store.createUserNode(projectId, node);
  store.recordHistory({
    id: randomUUID(),
    projectId,
    entityType: "node",
    entityId: node.id,
    action: "create",
    actor: LOCAL_USER,
    detail: JSON.stringify({ type: input.type, origin: "user" }),
    at: now,
  });
  return { node };
}
