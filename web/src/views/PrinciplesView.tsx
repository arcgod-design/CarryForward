import { useEffect, useMemo, useState } from "react";
import type { Project, NodeWithEvidence, NodeType } from "../../../shared/types";
import { api } from "../api";

const REVIEWABLE_TYPES: NodeType[] = ["principle", "decision", "convention", "procedure", "status-question"];

export function PrinciplesView({ project }: { project: Project | null }) {
  const [nodes, setNodes] = useState<NodeWithEvidence[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  function load(p: Project | null) {
    if (!p) return;
    api<{ nodes: NodeWithEvidence[] }>(`/projects/${p.id}/nodes`)
      .then((res) => setNodes(res.nodes))
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    if (!project) return;
    setNodes(null);
    setError(null);
    load(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function review(nodeId: string, action: string, edits?: { title?: string; content?: string }) {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${project.id}/nodes/${nodeId}/review`, {
        method: "POST",
        body: JSON.stringify({ action, ...edits }),
      });
      load(project);
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createNode() {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${project.id}/nodes`, {
        method: "POST",
        body: JSON.stringify({ title: newTitle, content: newContent, type: "principle" }),
      });
      setNewTitle("");
      setNewContent("");
      setShowCreate(false);
      load(project);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const reviewable = useMemo(
    () => (nodes ?? []).filter((n) => REVIEWABLE_TYPES.includes(n.node.type)),
    [nodes]
  );

  const filtered = useMemo(() => {
    return reviewable.filter((n) => {
      if (typeFilter !== "all" && n.node.type !== typeFilter) return false;
      if (statusFilter !== "all" && n.node.status !== statusFilter) return false;
      if (query && !(`${n.node.title} ${n.node.content}`.toLowerCase().includes(query.toLowerCase()))) return false;
      return true;
    });
  }, [reviewable, typeFilter, statusFilter, query]);

  if (!project) {
    return (
      <section className="view">
        <header className="view-header">
          <h1>Principles</h1>
          <p className="view-lede">Open a repository in the Project view first.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>Principles</h1>
        <p className="view-lede">
          Discovered candidates with their source evidence. Machine-discovered items stay candidates until you act on
          them. Approved rules are the only rules the instruction pack and change checks treat as binding.
        </p>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}
      {!nodes && !error && <p className="dim">Loading…</p>}

      {nodes && (
        <div className="row">
          <button className="btn" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "Add a principle"}
          </button>
        </div>
      )}

      {showCreate && (
        <div className="panel">
          <label htmlFor="new-title" className="field-label">Title</label>
          <input
            id="new-title"
            className="input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="All database access must go through the repository layer"
          />
          <label htmlFor="new-content" className="field-label">Content</label>
          <textarea
            id="new-content"
            className="input"
            rows={3}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What the rule requires and why it matters."
          />
          <div className="action-row">
            <button className="btn primary" onClick={createNode} disabled={busy || !newTitle.trim() || !newContent.trim()}>
              Add as approved principle
            </button>
          </div>
        </div>
      )}

      {nodes && reviewable.length === 0 && (
        <div className="panel">
          <p className="dim">
            No reviewable candidates yet. Run <strong>Scan repository</strong> in the Project view, or add a principle
            yourself above.
          </p>
        </div>
      )}

      {nodes && reviewable.length > 0 && (
        <>
          <div className="row filters">
            <input
              className="input"
              placeholder="Search title or content…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search candidates"
            />
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type">
              <option value="all">All types</option>
              {REVIEWABLE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="candidate">candidate</option>
              <option value="user-approved">user-approved</option>
              <option value="rejected">rejected</option>
              <option value="uncertain">uncertain</option>
            </select>
          </div>

          <p className="dim">{filtered.length} of {reviewable.length} shown.</p>

          <div className="node-list">
            {filtered.map(({ node, evidence }) => (
              <article key={node.id} className={`node-card status-${node.status}`}>
                <button className="node-card-head" onClick={() => setExpanded(expanded === node.id ? null : node.id)}>
                  <div className="node-card-title">
                    <span className={`badge ${node.status === "user-approved" ? "approved" : node.status === "candidate" ? "candidate" : node.status === "rejected" ? "conflict" : "inferred"}`}>
                      {node.status}
                    </span>
                    <span className="badge">{node.type}</span>
                    <strong>{node.title}</strong>
                  </div>
                  <span className="dim">{expanded === node.id ? "▾" : "▸"}</span>
                </button>
                {expanded === node.id && (
                  <div className="node-card-body">
                    {editing === node.id ? (
                      <>
                        <label className="field-label" htmlFor={`title-${node.id}`}>Title</label>
                        <input
                          id={`title-${node.id}`}
                          className="input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                        <label className="field-label" htmlFor={`content-${node.id}`}>Content</label>
                        <textarea
                          id={`content-${node.id}`}
                          className="input"
                          rows={3}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                        />
                        <div className="action-row">
                          <button className="btn approve" onClick={() => review(node.id, "approve", { title: editTitle, content: editContent })} disabled={busy}>
                            Save & approve
                          </button>
                          <button className="btn" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>{node.content}</p>
                        {node.approvedBy && (
                          <p className="dim">
                            Approved by {node.approvedBy}
                            {node.approvedAt && <> on {new Date(node.approvedAt).toLocaleString()}</>}.
                          </p>
                        )}
                        <h3>Evidence</h3>
                        {evidence.length === 0 && <p className="dim">No source evidence — user-authored rule.</p>}
                        {evidence.map((ev) => (
                          <div key={ev.id} className="evidence">
                            <div className="mono dim">
                              {ev.sourcePath}:{ev.startLine}
                              {ev.endLine !== ev.startLine ? `–${ev.endLine}` : ""} · {ev.classification} · confidence {ev.confidence}
                            </div>
                            <pre className="excerpt">{ev.excerpt}</pre>
                          </div>
                        ))}
                        <div className="action-row">
                          {node.status !== "user-approved" && (
                            <button className="btn approve" onClick={() => review(node.id, "approve")} disabled={busy}>
                              Approve
                            </button>
                          )}
                          <button
                            className="btn"
                            onClick={() => {
                              setEditing(node.id);
                              setEditTitle(node.title);
                              setEditContent(node.content);
                            }}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          {node.status !== "rejected" && (
                            <button className="btn reject" onClick={() => review(node.id, "reject")} disabled={busy}>
                              Reject
                            </button>
                          )}
                          {node.status !== "uncertain" && (
                            <button className="btn" onClick={() => review(node.id, "uncertain")} disabled={busy}>
                              Mark uncertain
                            </button>
                          )}
                          {node.status !== "superseded" && (
                            <button className="btn" onClick={() => review(node.id, "deprecate")} disabled={busy}>
                              Deprecate
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
