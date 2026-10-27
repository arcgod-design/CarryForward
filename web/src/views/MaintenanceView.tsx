import { useEffect, useState } from "react";
import type { Project, MaintenanceFlag } from "../../../shared/types";
import { api } from "../api";

interface MaintenanceResponse {
  flags: MaintenanceFlag[];
  watch: { watching: boolean; lastEvent: string | null; lastRefresh: string | null; error: string | null };
  lastScanAt: string | null;
}

export function MaintenanceView({ project }: { project: Project | null }) {
  const [data, setData] = useState<MaintenanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function load(p: Project | null) {
    if (!p) return;
    api<MaintenanceResponse>(`/projects/${p.id}/maintenance`)
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    if (!project) return;
    setData(null);
    setError(null);
    setNotice(null);
    load(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function refresh() {
    if (!project) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ changedFiles: string[]; flags: MaintenanceFlag[]; note: string }>(
        `/projects/${project.id}/refresh`,
        { method: "POST" }
      );
      setNotice(`${res.note} ${res.changedFiles.length} file(s) changed since the previous scan.`);
      load(project);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleWatch() {
    if (!project || !data) return;
    setBusy(true);
    setError(null);
    try {
      if (data.watch.watching) {
        await api(`/projects/${project.id}/watch/stop`, { method: "POST" });
        setNotice("Watcher stopped. Manual refresh remains available.");
      } else {
        const res = await api<{ note: string }>(`/projects/${project.id}/watch/start`, { method: "POST" });
        setNotice(res.note);
      }
      load(project);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resolve(flagId: string, status: "resolved" | "dismissed") {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${project.id}/maintenance/${flagId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ status, note: note || null }),
      });
      setNoteFor(null);
      setNote("");
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
          <h1>Maintenance</h1>
          <p className="view-lede">Open a repository in the Project view first.</p>
        </header>
      </section>
    );
  }

  const openFlags = data?.flags.filter((f) => f.status === "open") ?? [];
  const closedFlags = data?.flags.filter((f) => f.status !== "open") ?? [];

  return (
    <section className="view">
      <header className="view-header">
        <h1>Maintenance</h1>
        <p className="view-lede">
          Refresh re-scans the repository and flags stale or conflicting knowledge — both sides shown, nothing
          auto-resolved. User-approved rules are never rewritten by a refresh; they are only flagged for your review.
        </p>
      </header>

      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert warn">{notice}</div>}

      <div className="panel">
        <div className="row space">
          <button className="btn primary" onClick={refresh} disabled={busy}>
            {busy ? "Refreshing…" : "Refresh now"}
          </button>
          {data && (
            <button className="btn" onClick={toggleWatch} disabled={busy}>
              {data.watch.watching ? "Stop watching" : "Watch for changes (best effort)"}
            </button>
          )}
        </div>
        {data && (
          <p className="dim" style={{ marginTop: 10 }}>
            Last scan: {data.lastScanAt ? new Date(data.lastScanAt).toLocaleString() : "never"}
            {data.watch.watching && <> · watching{data.watch.lastEvent ? ` · last event: ${data.watch.lastEvent}` : ""}</>}
          </p>
        )}
        {data?.watch.error && <div className="alert warn">{data.watch.error}</div>}
      </div>

      {data && openFlags.length === 0 && (
        <div className="panel">
          <h2>Flags</h2>
          <p className="dim">
            No open stale or conflict flags. This means the last refresh found no record whose supporting evidence
            disappeared, changed, or conflicted — not that the repository has no problems.
          </p>
        </div>
      )}

      {openFlags.length > 0 && (
        <div className="node-list">
          {openFlags.map((flag) => (
            <article key={flag.id} className={`finding-card ${flag.kind === "conflict" ? "severity-high" : "severity-medium"}`}>
              <div className="node-card-title">
                <span className={`badge ${flag.kind === "conflict" ? "conflict" : "candidate"}`}>{flag.kind}</span>
                <strong>{flag.nodeTitle}</strong>
                <span className="badge">node status: {flag.nodeStatus}</span>
              </div>
              <p>{flag.reason}</p>
              {flag.sideA && (
                <div className="evidence">
                  <div className="mono dim">Side A — {flag.sideA.label}</div>
                  <pre className="excerpt">{flag.sideA.detail}</pre>
                </div>
              )}
              {flag.sideB && (
                <div className="evidence">
                  <div className="mono dim">Side B — {flag.sideB.label}</div>
                  <pre className="excerpt">{flag.sideB.detail}</pre>
                </div>
              )}
              <p className="dim">Flagged {new Date(flag.createdAt).toLocaleString()}.</p>
              {noteFor === flag.id ? (
                <div className="link-form">
                  <input
                    className="input"
                    placeholder="Resolution note (what did you decide and why?)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    aria-label="Resolution note"
                  />
                  <div className="action-row">
                    <button className="btn small approve" onClick={() => resolve(flag.id, "resolved")} disabled={busy}>
                      Save as resolved
                    </button>
                    <button className="btn small reject" onClick={() => resolve(flag.id, "dismissed")} disabled={busy}>
                      Dismiss
                    </button>
                    <button className="btn small" onClick={() => { setNoteFor(null); setNote(""); }} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="action-row">
                  <button className="btn small" onClick={() => setNoteFor(flag.id)} disabled={busy}>
                    Resolve / dismiss
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {closedFlags.length > 0 && (
        <div className="panel">
          <h2>Resolved / dismissed ({closedFlags.length})</h2>
          <ul className="link-list">
            {closedFlags.map((f) => (
              <li key={f.id}>
                <span className="dim">{f.nodeTitle} — {f.status}{f.resolutionNote ? `: ${f.resolutionNote}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
