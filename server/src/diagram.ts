import type { Project, NodeWithEvidence, KnowledgeEdge, SourceFileRecord } from "../../shared/types";

const AMP = String.fromCharCode(38);
const ESCAPES: [RegExp, string][] = [
  [new RegExp(AMP, "g"), AMP + "amp;"],
  [new RegExp("<", "g"), AMP + "lt;"],
  [new RegExp(">", "g"), AMP + "gt;"],
  [new RegExp('"', "g"), AMP + "quot;"],
  [new RegExp("'", "g"), AMP + "#39;"],
];

function esc(s: string): string {
  let out = s;
  for (const [re, to] of ESCAPES) out = out.replace(re, to);
  return out;
}

const STATUS_CLASS: Record<string, string> = {
  "user-approved": "approved",
  candidate: "cand",
  rejected: "rej",
  uncertain: "unc",
};

export function buildArchitectureHtml(
  project: Project,
  nodes: NodeWithEvidence[],
  edges: KnowledgeEdge[],
  files: SourceFileRecord[]
): string {
  const components = nodes
    .filter((n) => n.node.type === "component")
    .map((n) => {
      const name = n.node.title.replace(/^Component: /, "").replace(/\/$/, "");
      const fileCount = files.filter((f) => f.relativePath === name || f.relativePath.startsWith(`${name}/`)).length;
      const governedBy = edges.filter((e) => e.relation === "governs" && e.targetNodeId === n.node.id).length;
      return { id: n.node.id, name, fileCount, governedBy, content: n.node.content };
    })
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 12);

  const approved = nodes.filter((n) => n.node.status === "user-approved" && ["principle", "convention"].includes(n.node.type));
  const decisions = nodes.filter((n) => n.node.type === "decision").slice(0, 12);
  const procedures = nodes.filter((n) => n.node.type === "procedure" && n.node.status !== "rejected").slice(0, 10);

  const generated = new Date().toISOString();
  const commitLine = project.lastCommit ? esc(project.lastCommit.slice(0, 12)) : "not a git repository";

  const boxW = 240;
  const boxH = 96;
  const gapX = 40;
  const gapY = 60;
  const perRow = 3;
  const rows = Math.max(1, Math.ceil(components.length / perRow));
  const svgW = Math.max(720, perRow * (boxW + gapX) + gapX);
  const svgH = rows * (boxH + gapY) + gapY;

  let boxes = "";
  components.forEach((c, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = gapX + col * (boxW + gapX);
    const y = gapY + row * (boxH + gapY);
    boxes += `
  <g class="comp" data-id="${esc(c.id)}">
    <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="10"/>
    <text x="${x + 14}" y="${y + 28}" class="comp-name">${esc(c.name)}/</text>
    <text x="${x + 14}" y="${y + 50}" class="comp-sub">${c.fileCount} file${c.fileCount === 1 ? "" : "s"}</text>
    <text x="${x + 14}" y="${y + 72}" class="comp-sub">${c.governedBy} governing rule${c.governedBy === 1 ? "" : "s"}</text>
  </g>`;
  });

  const svg = `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Component architecture">
  <style>
    .comp rect { fill:#151a21; stroke:#313c4a; stroke-width:1.5; }
    .comp:hover rect { stroke:#4fd1c5; }
    .comp-name { fill:#e6e9ee; font:600 15px "Segoe UI",sans-serif; }
    .comp-sub { fill:#8b95a5; font:12px "Segoe UI",sans-serif; }
    text { pointer-events:none; }
  </style>
  ${boxes}
</svg>`;

  const principleChips = approved.length
    ? approved
        .map((n) => `<li><span class="badge ${STATUS_CLASS[n.node.status] ?? ""}">${esc(n.node.status)}</span> ${esc(n.node.title)}</li>`)
        .join("")
    : '<li class="dim">No principles user-approved yet — approve some in CarryForward for a complete diagram.</li>';

  const decisionList = decisions.length
    ? decisions
        .map((n) => {
          const src = n.evidence[0];
          const srcRef = src ? `<span class="src">SRC ${esc(src.sourcePath)}:${src.startLine}</span>` : "";
          return `<li><strong>${esc(n.node.title)}</strong> ${srcRef}<br><span class="dim">${esc(n.node.content.slice(0, 220))}</span></li>`;
        })
        .join("")
    : '<li class="dim">No decision records discovered.</li>';

  const procedureList = procedures.length
    ? procedures.map((n) => `<li>${esc(n.node.content)}</li>`).join("")
    : '<li class="dim">No procedures discovered.</li>';

  const relationList = edges.length
    ? edges
        .slice(0, 40)
        .map((e) => {
          const s = nodes.find((n) => n.node.id === e.sourceNodeId);
          const t = nodes.find((n) => n.node.id === e.targetNodeId);
          if (!s || !t) return "";
          return `<li><span class="mono">${esc(s.node.title)}</span> → <strong>${esc(e.relation)}</strong> → <span class="mono">${esc(t.node.title)}</span>${e.origin === "user" ? ' <span class="badge">your link</span>' : ""}</li>`;
        })
        .join("")
    : '<li class="dim">No links recorded yet.</li>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CarryForward architecture — ${esc(project.displayName)}</title>
<style>
:root{--bg:#0e1116;--panel:#151a21;--border:#232b36;--text:#e6e9ee;--dim:#8b95a5;--accent:#4fd1c5}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 "Segoe UI",system-ui,sans-serif}
header{padding:14px 20px;border-bottom:1px solid var(--border)}
header h1{font-size:17px;margin:0 0 4px}
header .meta{color:var(--dim);font-size:12px}
main{max-width:1100px;margin:0 auto;padding:20px;display:flex;flex-direction:column;gap:18px}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px 20px}
.panel h2{font-size:14px;margin:0 0 10px}
svg{width:100%;height:auto;background:#0e1116;border:1px solid var(--border);border-radius:8px}
ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
li{padding:6px 0;border-bottom:1px solid var(--border)}
.badge{display:inline-block;border:1px solid var(--border);border-radius:999px;font-size:11px;padding:1px 9px;margin-right:6px;color:var(--dim)}
.badge.approved{color:#3fb950;border-color:#1f4a29}
.badge.cand{color:#d29922;border-color:#6e531e}
.badge.rej{color:#f85149;border-color:#6e2b28}
.badge.unc{color:#58a6ff;border-color:#1f4a6e}
.src{font-family:Consolas,monospace;font-size:11.5px;color:var(--accent);border:1px solid var(--border);border-radius:5px;padding:1px 7px;margin-left:6px}
.mono{font-family:Consolas,monospace;font-size:12.5px}
.dim{color:var(--dim)}
footer{color:var(--dim);font-size:12px;padding:8px 20px 24px}
</style>
</head>
<body>
<header>
  <h1>CarryForward architecture — ${esc(project.displayName)}</h1>
  <div class="meta">Generated ${generated} · evidence captured at commit ${commitLine} · ${components.length} components · ${edges.length} links · ${nodes.length} knowledge nodes</div>
</header>
<main>
  <div class="panel">
    <h2>Components (top ${components.length} by tracked files)</h2>
    ${svg}
    <p class="dim">Components are directories with recognized source code. Governing rules are approved principles whose links target the component. The repository's own files remain authoritative.</p>
  </div>
  <div class="panel">
    <h2>Approved principles and conventions</h2>
    <ul>${principleChips}</ul>
  </div>
  <div class="panel">
    <h2>Decisions with source evidence</h2>
    <ul>${decisionList}</ul>
  </div>
  <div class="panel">
    <h2>Verification procedures</h2>
    <ul>${procedureList}</ul>
  </div>
  <div class="panel">
    <h2>Relationships</h2>
    <ul>${relationList}</ul>
  </div>
</main>
<footer>Generated by CarryForward from its evidence store (snapshot, not live). Diagram pattern inspired by <strong>archify</strong> (open source, Apache-2.0/MIT) and implemented natively — no third-party code vendored. Static snapshot: the working tree may have moved ahead of commit ${commitLine}.</footer>
</body>
</html>`;
}
