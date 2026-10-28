import { useEffect, useState } from "react";
import type { Project } from "../../../shared/types";
import { api } from "../api";

export function CodeGraphView({ project }: { project: Project | null }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [howTo, setHowTo] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  function check(p: Project | null) {
    if (!p) return;
    setAvailable(null);
    setError(null);
    api<unknown>(`/projects/${p.id}/codegraph`)
      .then(() => setAvailable(true))
      .catch(() => {
        setAvailable(false);
        setHowTo([
          "uv tool install graphifyy   # graphify CLI (open source, Apache-2.0/MIT)",
          "graphify install            # register the skill (optional)",
        ]);
      });
  }

  useEffect(() => {
    if (!project) return;
    check(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function generate() {
    if (!project) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ note: string }>(`/projects/${project.id}/codegraph/generate`, { method: "POST" });
      setAvailable(true);
      setFrameKey((k) => k + 1);
      setError(null);
      setHowTo([]);
      setNotice(res.note);
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
          <h1>Code Graph</h1>
          <p className="view-lede">Open a repository in the Project view first.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>Code Graph</h1>
        <p className="view-lede">
          The full code-structure graph, rendered by <strong>graphify</strong> (open source, Apache-2.0/MIT) and served
          unmodified from this repository's <span className="mono">graphify-out/graph.html</span>. CarryForward
          attributes the tool and drives its CLI; the knowledge graph in the Graph view is CarryForward's own
          evidence-linked layer on top.
        </p>
      </header>

      {available === null && <p className="dim">Checking for graphify output in this repository…</p>}

      {notice && <div className="alert warn">{notice}</div>}
      {error && available !== false && <div className="alert error" role="alert">{error}</div>}

      {available === false && (
        <div className="panel">
          <h2>Set up graphify for this repository</h2>
          <p className="dim">
            graphify maps the entire codebase into an interactive graph. It is open source (Apache-2.0/MIT). CarryForward
            runs its CLI inside the repository and serves the result unmodified.
          </p>
          <ol className="setup-steps">
            {howTo.map((step) => (
              <li key={step}>
                <code className="mono">{step}</code>
              </li>
            ))}
          </ol>
          <div className="action-row">
            <button className="btn primary" onClick={generate} disabled={busy}>
              {busy ? "Running graphify…" : "Generate with graphify"}
            </button>
          </div>
        </div>
      )}

      {busy && <p className="dim">graphify is parsing the repository (this can take a while on large repos)…</p>}

      {available && (
        <>
          <div className="row">
            <button className="btn" onClick={generate} disabled={busy}>
              {busy ? "Regenerating…" : "Regenerate with graphify"}
            </button>
            <button className="btn" onClick={() => window.open(`/api/projects/${project.id}/codegraph`, "_blank")}>
              Open full screen
            </button>
          </div>
          <iframe
            key={frameKey}
            title="graphify code graph"
            className="embed-frame"
            src={`/api/projects/${project.id}/codegraph?t=${frameKey}`}
          />
        </>
      )}
    </section>
  );
}
