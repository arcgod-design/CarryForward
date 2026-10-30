import { useEffect, useState } from "react";
import type { Project } from "../../../shared/types";

export function DiagramsView({ project }: { project: Project | null }) {
  const [hasDiagram, setHasDiagram] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    if (!project) return;
    setHasDiagram(false);
    setError(null);
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  function generate() {
    if (!project) return;
    setBusy(true);
    setError(null);
    const url = `/api/projects/${project.id}/diagram/architecture`;
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body: { error?: string }) => {
            throw new Error(body.error ?? `Request failed (${res.status})`);
          });
        }
        setHasDiagram(true);
        setFrameKey((k) => k + 1);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setBusy(false));
  }

  if (!project) {
    return (
      <section className="view">
        <header className="view-header">
          <h1>Diagrams</h1>
          <p className="view-lede">Open a repository in the Project view first.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>Diagrams</h1>
        <p className="view-lede">
          A shareable architecture diagram of the discovered components, dependency flow, approved rules, decisions
          with SRC evidence markers, and relationships — one self-contained HTML file, regenerated automatically from
          the latest scan. The pattern is inspired by <strong>archify</strong> (open source, Apache-2.0/MIT) and
          implemented natively; no third-party code is vendored.
        </p>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}
      {busy && <p className="dim">Generating from the latest scan…</p>}

      <div className="panel">
        <div className="row">
          <button className="btn" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Re-generate from latest scan"}
          </button>
          {hasDiagram && (
            <button
              className="btn"
              onClick={() => window.open(`/api/projects/${project.id}/diagram/architecture`, "_blank")}
            >
              Open in new tab
            </button>
          )}
        </div>
      </div>

      {hasDiagram && (
        <iframe
          key={frameKey}
          title="CarryForward architecture diagram"
          className="embed-frame"
          src={`/api/projects/${project.id}/diagram/architecture?t=${frameKey}`}
        />
      )}
    </section>
  );
}
