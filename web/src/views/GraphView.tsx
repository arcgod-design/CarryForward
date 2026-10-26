import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type EventObject } from "cytoscape";
import type { Project, NodeWithEvidence, KnowledgeEdge, NodeType, EdgeRelation } from "../../../shared/types";
import { api } from "../api";

const TYPE_COLORS: Record<string, string> = {
  principle: "#4fd1c5",
  decision: "#58a6ff",
  component: "#8b95a5",
  convention: "#d29922",
  procedure: "#bc8cff",
  dependency: "#39c5cf",
  verification: "#3fb950",
  "status-question": "#f0883e",
};

const ALL_TYPES: NodeType[] = ["principle", "decision", "component", "convention", "procedure", "dependency", "verification", "status-question"];
const ALL_RELATIONS: EdgeRelation[] = ["governs", "implemented_by", "depends_on", "verified_by", "supersedes", "contradicts", "related_to"];

interface GraphData {
  nodes: NodeWithEvidence[];
  edges: KnowledgeEdge[];
}

export function GraphView({ project }: { project: Project | null }) {
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkRelation, setLinkRelation] = useState<EdgeRelation>("related_to");
  const [linkTarget, setLinkTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const cyRef = useRef<Core | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  function load(p: Project | null) {
    if (!p) return;
    api<GraphData>(`/projects/${p.id}/nodes`)
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    if (!project) return;
    setData(null);
    setError(null);
    setSelectedId(null);
    load(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const neighbors = useMemo(() => {
    if (!data || !selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const e of data.edges) {
      if (e.sourceNodeId === selectedId) set.add(e.targetNodeId);
      if (e.targetNodeId === selectedId) set.add(e.sourceNodeId);
    }
    return set;
  }, [data, selectedId]);

  const visibleNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.filter((n) => {
      if (typeFilter !== "all" && n.node.type !== typeFilter) return false;
      if (query && !n.node.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (focusMode && selectedId && !neighbors.has(n.node.id)) return false;
      return true;
    });
  }, [data, typeFilter, query, focusMode, selectedId, neighbors]);

  useEffect(() => {
    if (!containerRef.current || !data) return;
    const visibleIds = new Set(visibleNodes.map((n) => n.node.id));
    const elements = [
      ...visibleNodes.map((n) => ({
        data: {
          id: n.node.id,
          label: n.node.title.length > 26 ? n.node.title.slice(0, 24) + "…" : n.node.title,
          color: TYPE_COLORS[n.node.type] ?? "#8b95a5",
          approved: n.node.status === "user-approved",
          rejected: n.node.status === "rejected",
        },
      })),
      ...data.edges
        .filter((e) => visibleIds.has(e.sourceNodeId) && visibleIds.has(e.targetNodeId))
        .map((e) => ({
          data: {
            id: e.id,
            source: e.sourceNodeId,
            target: e.targetNodeId,
            relation: e.relation,
            userOrigin: e.origin === "user",
          },
        })),
    ];

    if (!cyRef.current) {
      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "background-color": "data(color)",
              color: "#e6e9ee",
              "font-size": 9,
              "font-family": "Segoe UI, sans-serif",
              width: 22,
              height: 22,
              "border-width": 3,
              "border-color": "#232b36",
              "text-valign": "bottom",
              "text-margin-y": 6,
              "text-wrap": "ellipsis",
              "text-max-width": "120px",
            },
          },
          {
            selector: "node[approved]",
            style: {
              "border-color": "#3fb950",
            },
          },
          {
            selector: "node[rejected]",
            style: {
              opacity: 0.45,
            },
          },
          {
            selector: "edge",
            style: {
              width: 1.5,
              "line-color": "#313c4a",
              "target-arrow-color": "#313c4a",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
            },
          },
          {
            selector: "edge[userOrigin]",
            style: {
              "line-color": "#4fd1c5",
              "target-arrow-color": "#4fd1c5",
              "line-style": "dashed",
            },
          },
          {
            selector: "node:selected",
            style: {
              "border-color": "#4fd1c5",
              "border-width": 4,
            },
          },
        ],
        layout: { name: "cose", animate: false, padding: 24 } as never,
      });
      cy.on("tap", "node", (ev: EventObject) => {
        setSelectedId(ev.target.id());
      });
      cy.on("tap", (ev: EventObject) => {
        if (ev.target === cy) setSelectedId(null);
      });
      cyRef.current = cy;
    } else {
      const cy = cyRef.current;
      cy.elements().remove();
      cy.add(elements);
      cy.layout({ name: "cose", animate: false, padding: 24 } as never).run();
    }
  }, [data, visibleNodes]);

  useEffect(() => {
    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, []);

  const selected = useMemo(
    () => data?.nodes.find((n) => n.node.id === selectedId) ?? null,
    [data, selectedId]
  );

  const connected = useMemo(() => {
    if (!data || !selectedId) return [];
    const out: { edge: KnowledgeEdge; other: NodeWithEvidence; direction: "out" | "in" }[] = [];
    for (const e of data.edges) {
      if (e.sourceNodeId === selectedId) {
        const other = data.nodes.find((n) => n.node.id === e.targetNodeId);
        if (other) out.push({ edge: e, other, direction: "out" });
      } else if (e.targetNodeId === selectedId) {
        const other = data.nodes.find((n) => n.node.id === e.sourceNodeId);
        if (other) out.push({ edge: e, other, direction: "in" });
      }
    }
    return out;
  }, [data, selectedId]);

  async function addLink() {
    if (!project || !selectedId || !linkTarget) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${project.id}/edges`, {
        method: "POST",
        body: JSON.stringify({ sourceNodeId: selectedId, targetNodeId: linkTarget, relation: linkRelation }),
      });
      setLinkMode(false);
      setLinkTarget("");
      load(project);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(edgeId: string) {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${project.id}/edges/${edgeId}`, { method: "DELETE" });
      load(project);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!project) {
    return (
      <section className="view">
        <header className="view-header">
          <h1>Graph</h1>
          <p className="view-lede">Open a repository in the Project view first.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>Graph</h1>
        <p className="view-lede">
          Evidence-backed links only. Solid gray links come from source evidence; dashed teal links you created
          yourself. Green border = user-approved.
        </p>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}

      {data && data.nodes.length === 0 && (
        <div className="panel">
          <p className="dim">Nothing in the graph yet. Run <strong>Scan repository</strong> in the Project view.</p>
        </div>
      )}

      {data && data.nodes.length > 0 && (
        <div className="graph-layout">
          <div className="graph-side">
            <div className="row filters">
              <input
                className="input"
                placeholder="Search nodes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search nodes"
              />
              <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type">
                <option value="all">All types</option>
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={focusMode}
                onChange={(e) => setFocusMode(e.target.checked)}
                disabled={!selectedId}
              />
              Focus on selected node + neighbors
            </label>
            <p className="dim">{visibleNodes.length} nodes shown.</p>
            <button className="btn small" onClick={() => window.open(`/api/projects/${project.id}/graph/export`, "_blank")}>
              Export graph.json
            </button>
            <div className="graph-node-list">
              {visibleNodes.map(({ node }) => (
                <button
                  key={node.id}
                  className={`graph-list-item ${node.id === selectedId ? "active" : ""}`}
                  onClick={() => setSelectedId(node.id)}
                >
                  <span className="dot" style={{ background: TYPE_COLORS[node.type] ?? "#8b95a5" }} aria-hidden="true"></span>
                  <span className="graph-list-title">{node.title}</span>
                  {node.status === "user-approved" && <span className="badge approved">approved</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="graph-canvas-wrap">
            <div ref={containerRef} className="graph-canvas" role="img" aria-label="Knowledge graph canvas"></div>
          </div>

          {selected && (
            <aside className="graph-detail panel" aria-label="Selected node details">
              <h2>{selected.node.title}</h2>
              <div className="counts">
                <span className="badge">{selected.node.type}</span>
                <span className={`badge ${selected.node.status === "user-approved" ? "approved" : selected.node.status === "candidate" ? "candidate" : "inferred"}`}>
                  {selected.node.status}
                </span>
                {selected.node.origin === "user" && <span className="badge">user-authored</span>}
              </div>
              <p>{selected.node.content}</p>

              <h3>Evidence</h3>
              {selected.evidence.length === 0 && <p className="dim">No source evidence — user-authored node.</p>}
              {selected.evidence.map((ev) => (
                <div key={ev.id} className="evidence">
                  <div className="mono dim">
                    {ev.sourcePath}:{ev.startLine}
                    {ev.endLine !== ev.startLine ? `–${ev.endLine}` : ""} · {ev.classification} · confidence {ev.confidence}
                  </div>
                  <pre className="excerpt">{ev.excerpt}</pre>
                </div>
              ))}

              <h3>Connected ({connected.length})</h3>
              {connected.length === 0 && <p className="dim">No links yet.</p>}
              <ul className="link-list">
                {connected.map(({ edge, other, direction }) => (
                  <li key={edge.id}>
                    <button className="link-button" onClick={() => setSelectedId(other.node.id)}>
                      {direction === "out" ? `${edge.relation} → ` : `← ${edge.relation} · `}
                      {other.node.title}
                    </button>
                    {edge.origin === "user" && (
                      <button className="btn small danger" onClick={() => removeLink(edge.id)} disabled={busy}>
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {!linkMode ? (
                <div className="action-row">
                  <button className="btn small" onClick={() => setLinkMode(true)} disabled={busy}>
                    Link to another node
                  </button>
                </div>
              ) : (
                <div className="link-form">
                  <select className="input" value={linkRelation} onChange={(e) => setLinkRelation(e.target.value as EdgeRelation)} aria-label="Relation">
                    {ALL_RELATIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <select className="input" value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} aria-label="Target node">
                    <option value="">Choose node…</option>
                    {data.nodes
                      .filter((n) => n.node.id !== selectedId)
                      .map((n) => (
                        <option key={n.node.id} value={n.node.id}>{n.node.title}</option>
                      ))}
                  </select>
                  <div className="action-row">
                    <button className="btn small primary" onClick={addLink} disabled={busy || !linkTarget}>
                      Create link
                    </button>
                    <button className="btn small" onClick={() => { setLinkMode(false); setLinkTarget(""); }} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
