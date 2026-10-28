import { useState } from "react";
import type { Project } from "../../../shared/types";

export function DiagramsView({ project }: { project: Project | null }) {
  const [hasDiagram, setHasDiagram] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);

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

  function generate() {
    if (!project) return;
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
      .catch((err) => setError((err as Error).message));
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>Diagrams</h1>
        <p className="view-lede">
          A shareable architecture diagram of the discovered components, approved rules, decisions with SRC evidence
          markers, and relationships — one self-contained HTML file. The pattern is inspired by{" "}
          <strong>archify</strong> (open source, Apache-2.0/MIT) and implemented natively; no third-party code is
          vendored.
        </p>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}

      <div className="panel">
        <div className="row">
          <button className="btn primary" onClick={generate}>
            {hasDiagram ? "Regenerate architecture diagram" : "Generate architecture diagram"}
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
