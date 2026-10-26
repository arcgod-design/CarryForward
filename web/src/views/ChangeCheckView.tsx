import { useEffect, useState } from "react";
import type { Project, CheckResponse, DiffSource, Finding } from "../../../shared/types";
import { api } from "../api";

const CERTAINTY_LABEL: Record<string, string> = {
  deterministic: "deterministic",
  "strong-evidence": "strong evidence",
  "possible-concern": "possible concern",
  "needs-human-review": "needs human review",
};

export function ChangeCheckView({ project }: { project: Project | null }) {
  const [source, setSource] = useState<DiffSource>("unstaged");
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load(p: Project | null) {
    if (!p) return;
    api<{ run: CheckResponse["run"] | null; findings: Finding[] }>(`/projects/${p.id}/check`)
      .then((res) => {
        if (res.run) {
          setResult({ run: res.run, findings: res.findings, files: [], applicableRules: [] });
        }
      })
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    if (!project) return;
    setResult(null);
    setError(null);
    load(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function runCheck() {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<CheckResponse>(`/projects/${project.id}/check`, {
        method: "POST",
        body: JSON.stringify({ source, pasted }),
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setDisposition(findingId: string, disposition: "accepted" | "fixed" | "dismissed") {
    if (!project) return;
    setBusy(true);
    try {
      await api(`/projects/${project.id}/findings/${findingId}/disposition`, {
        method: "POST",
        body: JSON.stringify({ disposition }),
      });
      setResult((prev) =>
        prev
          ? { ...prev, findings: prev.findings.map((f) => (f.id === findingId ? { ...f, disposition } : f)) }
          : prev
      );
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
          <h1>Change Check</h1>
          <p className="view-lede">Open a repository in the Project view first.</p>
        </header>
      </section>
    );
  }

  const openFindings = result?.findings.filter((f) => f.disposition === "open") ?? [];
  const resolvedFindings = result?.findings.filter((f) => f.disposition !== "open") ?? [];

  return (
    <section className="view">
      <header className="view-header">
        <h1>Change Check</h1>
        <p className="view-lede">
          Inspect the repository's git diff (or paste one) against approved rules. Findings cite both sides of the
          evidence and say exactly how certain they are. A clean result means only that the checks that ran found
          nothing — never a guarantee.
        </p>
      </header>

      <div className="panel">
        <div className="row">
          <select className="input" value={source} onChange={(e) => setSource(e.target.value as DiffSource)} aria-label="Diff source">
            <option value="unstaged">git diff (unstaged)</option>
            <option value="staged">git diff --cached (staged)</option>
            <option value="both">git diff HEAD (both)</option>
            <option value="pasted">Paste a diff</option>
          </select>
          <button className="btn primary" onClick={runCheck} disabled={busy}>
            {busy ? "Checking…" : "Run check"}
          </button>
        </div>
        {source === "pasted" && (
          <textarea
            className="input mono"
            rows={6}
            placeholder="Paste a unified diff here…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            aria-label="Pasted diff"
          />
        )}
        {error && <div className="alert error" role="alert">{error}</div>}
      </div>

      {result?.run && (
        <>
          <div className="panel">
            <h2>Last run</h2>
            <p className="dim">
              {new Date(result.run.createdAt).toLocaleString()} · source: <span className="mono">{result.run.diffSource}</span> · {result.run.filesReviewed.length} file(s) · {result.run.summary}
            </p>
            <p className="dim">Checks that ran: {result.run.checksRun.join(" · ")}</p>
            {result.run.redactions.length > 0 && (
              <div className="alert warn">
                Secret-looking values were detected and redacted from the diff display: {result.run.redactions.join(", ")}.
              </div>
            )}
          </div>

          {openFindings.length === 0 && resolvedFindings.length === 0 && (
            <div className="panel">
              <h2>Findings</h2>
              <p className="dim">
                No findings — scoped result: only the checks listed above ran on this diff. This is not a claim that the
                change obeys every project principle or is bug-free.
              </p>
            </div>
          )}

          {openFindings.length > 0 && (
            <div className="node-list">
              {openFindings.map((f) => (
                <article key={f.id} className={`finding-card severity-${f.severity}`}>
                  <div className="row space">
                    <div className="node-card-title">
                      <span className={`badge ${f.certainty === "deterministic" ? "conflict" : f.certainty === "strong-evidence" ? "candidate" : "inferred"}`}>
                        {CERTAINTY_LABEL[f.certainty]}
                      </span>
                      <span className="badge">{f.kind}</span>
                      {f.blocking && <span className="badge conflict">blocking</span>}
                      <strong>{f.ruleTitle ?? f.changedPath}</strong>
                    </div>
                    <span className={`badge severity-badge-${f.severity}`}>{f.severity}</span>
                  </div>
                  <p>{f.explanation}</p>
                  <h3>Evidence</h3>
                  {f.ruleEvidence && (
                    <div className="evidence">
                      <div className="mono dim">Rule: {f.ruleTitle}</div>
                      <pre className="excerpt">{f.ruleEvidence}</pre>
                    </div>
                  )}
                  <div className="evidence">
                    <div className="mono dim">Change: {f.changedPath}{f.changedLines ? `:${f.changedLines[0]}` : ""}</div>
                    <pre className="excerpt">{f.changedEvidence}</pre>
                  </div>
                  <h3>Recommended action</h3>
                  <p>{f.recommendation}</p>
                  <div className="action-row">
                    <button className="btn small approve" onClick={() => setDisposition(f.id, "fixed")} disabled={busy}>Mark fixed</button>
                    <button className="btn small" onClick={() => setDisposition(f.id, "accepted")} disabled={busy}>Accept as-is</button>
                    <button className="btn small reject" onClick={() => setDisposition(f.id, "dismissed")} disabled={busy}>Dismiss</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {resolvedFindings.length > 0 && (
            <div className="panel">
              <h2>Resolved in this run</h2>
              <ul className="link-list">
                {resolvedFindings.map((f) => (
                  <li key={f.id}>
                    <span className="dim">{f.ruleTitle ?? f.changedPath} — {f.disposition}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.files.length > 0 && (
            <div className="panel">
              <h2>Changed files ({result.files.length})</h2>
              {result.files.map((file) => (
                <details key={file.path} className="file-table">
                  <summary className="mono">{file.path}</summary>
                  {file.hunks.map((hunk, i) => (
                    <pre key={i} className="excerpt diff-hunk">
                      {hunk.changes.map((c, j) => (
                        <span key={j} className={`diff-line diff-${c.type}`}>
                          {c.content}
                          {c.redacted ? "   [redacted]" : ""}
                        </span>
                      ))}
                    </pre>
                  ))}
                </details>
              ))}
            </div>
          )}

          {result.applicableRules.length > 0 && (
            <div className="panel">
              <h2>Applicable approved rules</h2>
              <ul className="link-list">
                {result.applicableRules.map((r) => (
                  <li key={`${r.ruleNodeId}-${r.appliesTo}`}>
                    <span>{r.title}</span>
                    <span className="dim"> applies to {r.appliesTo} — <span className="mono">{r.evidencePointer}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
