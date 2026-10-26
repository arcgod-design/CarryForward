import { useEffect, useState } from "react";
import type { Project } from "../../../shared/types";
import { api } from "../api";

interface PackInfo {
  id: string;
  generatedAt: string;
  content: string;
  sourceFingerprint: string;
  format: string;
  counts?: Record<string, number>;
}

export function PackView({ project }: { project: Project | null }) {
  const [pack, setPack] = useState<PackInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("AGENTS.md");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  function load(p: Project | null) {
    if (!p) return;
    api<{ pack: PackInfo | null }>(`/projects/${p.id}/pack`)
      .then((res) => setPack(res.pack))
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    if (!project) return;
    setPack(null);
    setError(null);
    setNotice(null);
    load(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function generate() {
    if (!project) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ pack: PackInfo }>(`/projects/${project.id}/pack/generate`, { method: "POST" });
      setPack(res.pack);
      setNotice("Pack generated from the current approved graph.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function exportToRepo() {
    if (!project) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ writtenTo: string; bytes: number }>(`/projects/${project.id}/pack/export`, {
        method: "POST",
        body: JSON.stringify({ filename, overwrite: confirmOverwrite }),
      });
      setNotice(`Written to ${res.writtenTo} (${res.bytes} bytes) inside the repository.`);
      setConfirmOverwrite(false);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("already exists")) {
        setError(message);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!pack) return;
    const blob = new Blob([pack.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AGENTS.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    if (!pack) return;
    try {
      await navigator.clipboard.writeText(pack.content);
      setNotice("Copied to clipboard.");
    } catch {
      setError("Clipboard copy failed — use the download button instead.");
    }
  }

  if (!project) {
    return (
      <section className="view">
        <header className="view-header">
          <h1>Instruction Pack</h1>
          <p className="view-lede">Open a repository in the Project view first.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>Instruction Pack</h1>
        <p className="view-lede">
          A deterministic AGENTS.md-style pack built from approved rules and their evidence. Only user-approved
          principles are binding; machine candidates are deliberately excluded. Secrets are excluded.
        </p>
      </header>

      {error && (
        <div className="alert error" role="alert">
          {error}
          {error.includes("already exists") && (
            <div className="action-row">
              <button className="btn small danger" onClick={() => { setConfirmOverwrite(true); }} disabled={busy}>
                Overwrite the existing file
              </button>
              <button className="btn small" onClick={() => setFilename("CARRYFORWARD-INSTRUCTIONS.md")} disabled={busy}>
                Use CARRYFORWARD-INSTRUCTIONS.md instead
              </button>
            </div>
          )}
        </div>
      )}
      {notice && <div className="alert warn">{notice}</div>}

      <div className="panel">
        <div className="row space">
          <button className="btn primary" onClick={generate} disabled={busy}>
            {busy ? "Working…" : pack ? "Regenerate pack" : "Generate pack"}
          </button>
          {pack && (
            <div className="row">
              <button className="btn" onClick={copy} disabled={busy}>Copy</button>
              <button className="btn" onClick={download} disabled={busy}>Download</button>
            </div>
          )}
        </div>
        {pack && (
          <p className="dim" style={{ marginTop: 10 }}>
            Generated {new Date(pack.generatedAt).toLocaleString()} · fingerprint <span className="mono">{pack.sourceFingerprint}</span> · format {pack.format}
          </p>
        )}
      </div>

      {pack && (
        <div className="panel">
          <h2>Export into the repository</h2>
          <p className="dim">
            Writes the pack as a file inside the opened repository. If <span className="mono">AGENTS.md</span> already
            exists there, you must confirm the overwrite — CarryForward never silently replaces existing instructions.
          </p>
          <div className="row">
            <input className="input mono" value={filename} onChange={(e) => setFilename(e.target.value)} aria-label="Export filename" />
            <button className="btn danger" onClick={exportToRepo} disabled={busy || !pack}>
              {confirmOverwrite ? `Overwrite ${filename}` : "Write file into repo"}
            </button>
          </div>
          {confirmOverwrite && <div className="alert warn">Overwrite confirmed — the existing file will be replaced on export.</div>}
        </div>
      )}

      {pack && (
        <div className="panel">
          <h2>Preview</h2>
          <pre className="excerpt pack-preview">{pack.content}</pre>
        </div>
      )}

      {!pack && !error && (
        <div className="panel">
          <p className="dim">No pack generated yet. Approve principles first so the pack carries real rules.</p>
        </div>
      )}
    </section>
  );
}
