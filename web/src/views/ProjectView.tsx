import { useState, useEffect } from "react";
import type { Project, ScanResponse, SourceFileRecord } from "../../../shared/types";
import { api } from "../api";

export function ProjectView({ project, onProject }: { project: Project | null; onProject: (p: Project) => void }) {
  const [rootPath, setRootPath] = useState(project?.rootPath ?? "");
  const [current, setCurrent] = useState<Project | null>(project);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCurrent(project);
    if (project) setRootPath(project.rootPath);
  }, [project]);

  async function openProject() {
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ project: Project }>("/projects", {
        method: "POST",
        body: JSON.stringify({ rootPath }),
      });
      setCurrent(res.project);
      onProject(res.project);
      setScan(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runScan() {
    if (!current) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api<ScanResponse>(`/projects/${current.id}/scan`, { method: "POST" });
      setScan(res);
      const refreshed = await api<{ project: Project }>(`/projects/${current.id}`);
      setCurrent(refreshed.project);
      onProject(refreshed.project);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetIndex() {
    if (!current) return;
    if (!window.confirm("Remove CarryForward's stored index for this project? Repository files are not touched.")) return;
    setError(null);
    setBusy(true);
    try {
      await api(`/projects/${current.id}`, { method: "DELETE" });
      setScan(null);
      setCurrent(null);
      onProject(null as unknown as Project);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const parsed = scan ? scan.files.filter((f) => f.parseStatus === "parsed") : [];
  const skipped = scan ? scan.files.filter((f) => f.parseStatus !== "parsed") : [];

  return (
    <section className="view">
      <header className="view-header">
        <h1>Project</h1>
        <p className="view-lede">
          Open a local repository. CarryForward reads it on this machine only — nothing is uploaded, and the
          repository's files are never modified.
        </p>
      </header>

      <div className="panel">
        <label htmlFor="repo-path" className="field-label">
          Repository path
        </label>
        <div className="row">
          <input
            id="repo-path"
            className="input mono"
            placeholder="C:\path\to\repository"
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
          />
          <button className="btn primary" onClick={openProject} disabled={busy || !rootPath.trim()}>
            {busy ? "Working…" : "Open"}
          </button>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
      </div>

      {current && (
        <div className="panel">
          <div className="row space">
            <div>
              <h2 className="project-name">{current.displayName}</h2>
              <div className="mono dim">{current.rootPath}</div>
              <div className="dim">
                Opened {new Date(current.createdAt).toLocaleString()}
                {current.lastScanAt && <> · Last scan {new Date(current.lastScanAt).toLocaleString()}</>}
              </div>
            </div>
            <div className="row">
              <button className="btn" onClick={runScan} disabled={busy}>
                {busy ? "Scanning…" : "Scan repository"}
              </button>
              <button className="btn danger" onClick={resetIndex} disabled={busy}>
                Reset index
              </button>
            </div>
          </div>
        </div>
      )}

      {scan && (
        <div className="panel">
          <h2>Scan results</h2>
          <div className="counts">
            <span className="count ok">{scan.summary.parsed} readable</span>
            <span className="count warn">{scan.summary.skipped} skipped</span>
            {scan.summary.error > 0 && <span className="count bad">{scan.summary.error} errors</span>}
          </div>
          {scan.summary.truncated && (
            <div className="alert warn">
              Scan stopped early at the file-count cap. The repository is large; results are partial.
            </div>
          )}
          <FileTable title="Discovered files" files={parsed} />
          <FileTable title="Skipped (with reasons)" files={skipped} showReason />
        </div>
      )}
    </section>
  );
}

function FileTable({ title, files, showReason }: { title: string; files: SourceFileRecord[]; showReason?: boolean }) {
  if (files.length === 0) return <p className="dim">{title}: none.</p>;
  return (
    <details open={showReason ? false : true} className="file-table">
      <summary>
        {title} ({files.length})
      </summary>
      <table>
        <thead>
          <tr>
            <th>Path</th>
            <th>Size</th>
            {showReason && <th>Reason</th>}
          </tr>
        </thead>
        <tbody>
          {files.slice(0, 500).map((f) => (
            <tr key={f.id}>
              <td className="mono">{f.relativePath}</td>
              <td>{f.size > 0 ? `${Math.ceil(f.size / 1024)} KB` : "—"}</td>
              {showReason && <td className="dim">{f.skipReason ?? f.parseStatus}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {files.length > 500 && <p className="dim">Showing first 500 rows.</p>}
    </details>
  );
}
