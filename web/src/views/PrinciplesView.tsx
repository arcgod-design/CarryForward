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

  useEffect(() => {
    if (!project) return;
    setNodes(null);
    setError(null);
    api<{ nodes: NodeWithEvidence[] }>(`/projects/${project.id}/nodes`)
      .then((res) => setNodes(res.nodes))
      .catch((err) => setError((err as Error).message));
  }, [project]);

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
          Discovered candidates with their source evidence. Machine-discovered items stay candidates until you
          approve, edit, or reject them — approval actions arrive in the next build step.
        </p>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}
      {!nodes && !error && <p className="dim">Loading…</p>}

      {nodes && reviewable.length === 0 && (
        <div className="panel">
          <p className="dim">
            No reviewable candidates yet. Run <strong>Scan repository</strong> in the Project view. Discovery reads
            agent instruction files, project core docs, decision records, and conventions — with evidence for each.
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

          <p className="dim">{filtered.length} of {reviewable.length} candidates shown.</p>

          <div className="node-list">
            {filtered.map(({ node, evidence }) => (
              <article key={node.id} className={`node-card status-${node.status}`}>
                <button className="node-card-head" onClick={() => setExpanded(expanded === node.id ? null : node.id)}>
                  <div className="node-card-title">
                    <span className={`badge ${node.status === "user-approved" ? "approved" : node.status === "candidate" ? "candidate" : "inferred"}`}>
                      {node.status}
                    </span>
                    <span className="badge">{node.type}</span>
                    <strong>{node.title}</strong>
                  </div>
                  <span className="dim">{expanded === node.id ? "▾" : "▸"}</span>
                </button>
                {expanded === node.id && (
                  <div className="node-card-body">
                    <p>{node.content}</p>
                    <h3>Evidence</h3>
                    {evidence.length === 0 && <p className="dim">No evidence attached.</p>}
                    {evidence.map((ev) => (
                      <div key={ev.id} className="evidence">
                        <div className="mono dim">
                          {ev.sourcePath}:{ev.startLine}
                          {ev.endLine !== ev.startLine ? `–${ev.endLine}` : ""} · {ev.classification} · confidence {ev.confidence}
                        </div>
                        <pre className="excerpt">{ev.excerpt}</pre>
                      </div>
                    ))}
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
