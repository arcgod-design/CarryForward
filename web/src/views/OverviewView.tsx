import { useEffect, useState } from "react";
import type { Project, OverviewResponse } from "../../../shared/types";
import { api } from "../api";

export function OverviewView({ project }: { project: Project | null }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setData(null);
    setError(null);
    api<OverviewResponse>(`/projects/${project.id}/overview`)
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, [project]);

  if (!project) {
    return (
      <section className="view">
        <header className="view-header">
          <h1>Overview</h1>
          <p className="view-lede">Open a repository in the Project view first.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>Overview</h1>
        <p className="view-lede">
          Counts come from stored records only. Nothing here is estimated.
          {project.lastScanAt && <> Last scan: {new Date(project.lastScanAt).toLocaleString()}.</>}
        </p>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}

      {!data && !error && <p className="dim">Loading…</p>}

      {data && data.totals.nodes === 0 && (
        <div className="panel">
          <p className="dim">
            No knowledge records yet. Run <strong>Scan repository</strong> in the Project view — discovery finds
            candidate principles, decisions, conventions, and components with their source evidence.
          </p>
        </div>
      )}

      {data && data.totals.nodes > 0 && (
        <>
          <div className="counts-row">
            <div className="count-card">
              <span className="count-number">{data.totals.nodes}</span>
              <span className="count-label">knowledge nodes</span>
            </div>
            <div className="count-card">
              <span className="count-number">{data.totals.evidence}</span>
              <span className="count-label">evidence records</span>
            </div>
            <div className="count-card">
              <span className="count-number">{data.totals.edges}</span>
              <span className="count-label">graph links</span>
            </div>
            <div className="count-card">
              <span className="count-number">{data.byStatus["user-approved"] ?? 0}</span>
              <span className="count-label">approved rules</span>
            </div>
          </div>

          <div className="panel">
            <h2>By type</h2>
            <div className="counts">
              {Object.entries(data.byType).map(([type, count]) => (
                <span key={type} className="badge candidate">
                  {type}: {count}
                </span>
              ))}
            </div>
            <h2>By status</h2>
            <div className="counts">
              {Object.entries(data.byStatus).map(([status, count]) => (
                <span key={status} className={`badge ${status === "user-approved" ? "approved" : status === "candidate" ? "candidate" : ""}`}>
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Next</h2>
            <p className="dim">
              Review discovered candidates under <strong>Principles</strong>. Approved rules feed the instruction pack
              and change checks. Candidates are machine-discovered until you act on them.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
