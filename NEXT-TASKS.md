# NEXT-TASKS.md

Ordered task board, active week: WEEK-02 (graph experience upgrades + ship). Updated 2026-10-27, session 2.

1. [x] Slices 1–8 of `devpost/checklist.md` — built, verified, committed.
2. [x] Discipline docs — written truthfully from observed build state.
3. [x] LICENSE (MIT) + package.json license field — committed.
4. [x] Final repo audit — 93 tracked files, zero real secrets, learner profile untracked.
5. [x] Public GitHub push — https://github.com/arcgod-design/CarryForward (public, verified).
6. [x] Graph experience round (ADR 0006): raised caps, component-noise fix, curated canvas, zoom/hover labels, legend, expandable folder nodes, graph.html report, commit pinning, pack knowledge-structure section. 79/79 tests.
7. [x] Open-source integration round (ADR 0007): **Code Graph** section (graphify CLI + unmodified artifact, attributed), **Diagrams** section (native architecture HTML with SRC chips, archify-inspired), hostile-content escaping, safety policy for future clones/installs. 84/84 tests.
8. [ ] Learner re-checks the upgraded graph (hard-refresh, expand a folder, download graph.html, open Code Graph + Diagrams)  declares demo passed.
9. [ ] Demo video - learner records; shot list below.
10. [ ] Devpost submission (learner-only): repo URL, description, video link, personal answers.
11. [ ] 5-build wrap-up box: final review confirmation (learner).

## Demo video shot list (~2:40)

1. (0:00–0:20) Problem: rules scattered across repo files; agents miss them. Screen: CarryForward Project view.
2. (0:20–0:40) Open `fixtures/demo-repo`; scan; show exclusions notice.
3. (0:40–1:10) Principles: open the repository-layer candidate → evidence `PROJECT-CORE.md:7` → approve (edit adds `Forbidden pattern: \bquery\s*\( in src/services`).
4. (1:10–1:30) Graph: click the approved rule → walk to the src component → double-click to expand its files → click a file to show what it contributed → mention "Download graph.html" (one-file shareable memory).
5. (1:30–1:50) Instruction Pack: generate → preview (point at the repository-knowledge-structure section + excluded-candidates note) → copy.
6. (1:50–2:20) Change Check: unstaged diff → deterministic blocking finding, both evidence sides, certainty label.
7. (2:20–2:35) Maintenance: refresh → conflict flag (ADR 0001 vs 0002) with both sides; resolve it.
8. (2:35–2:45) Honest close: "local MVP today; shared team workspaces are the roadmap."
