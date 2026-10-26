---
doc: checklist
status: approved
---
# Build Checklist

Build mode: fast — recorded from the learner's standing directive ("just complete the project... complete it in one go"), which pre-approves the order below and requests minimal pauses. Checkpoints remain: the learner tries the app at the early and final hands-on points.

## Slices

- [x] **1. You can open a repository and see a safe, bounded scan**
  Becomes usable: A running app: type a local repo path, it validates, scans inside the root only with visible exclusions, and lists discovered files + skipped paths with reasons. Project record persists in SQLite.
  Why now: Bootstraps the entire stack (TS config, Express, Vite/React shell, vitest) AND proves the riskiest dependency (better-sqlite3 native binary) on day one, so nothing later is built on an unverified foundation.
  PRD ref: `prd.md > Opening a repository`, `prd.md > Screens and Layout` (Project view)
  Spec ref: `spec.md > Repository scanner`, `spec.md > Data Model`, `spec.md > File Structure`
  Build: Root package.json + tsconfig + vitest config; `shared/types.ts`; `server/src/` (index, routes, db, store, scanner, secrets); `web/src/` shell (App, styles tokens, api client, Project view); `data/` + `fixtures/` gitignored; scanner with exclusion list + bounds caps; project open/validate/scan/reset endpoints.
  Verify (mechanical): `npm test` — scanner tests: stays inside root, excludes `.git`/`node_modules`/`.env*`/secrets, records skip reasons, handles missing/unreadable paths gracefully. `npm run build` + server boots; `POST /api/projects` + scan on a temp fixture returns files.
  Learner check: `npm run demo`, open http://localhost:8787, type any local repo path, scan it, and see the file list + exclusions.
  Commit: `feat: open repository with safe bounded scan`

- [ ] **2. Discovery shows evidence-backed candidates with source locations**
  Becomes usable: After a scan, the Overview shows real counts and Principles lists discovered candidates (principles, decisions, conventions, components, procedures, dependencies, status claims) each with exact source path + line range + excerpt + classification.
  Why now: This is the product's raw material — nothing else (approvals, graph, pack, findings) exists without honest discovery evidence.
  PRD ref: `prd.md > Discovery and evidence`
  Spec ref: `spec.md > Extractor`, `spec.md > Graph store`
  Build: `extractor.ts` (file-role recognition, rule-language heuristics, ADR parsing, config/manifest parsing, component mapping), `graph.ts` (evidence-backed nodes/edges), store tables filled, Overview + Principles views with evidence panel.
  Verify (mechanical): Extractor unit tests on synthetic markdown: line numbers/excerpts match file content exactly; ADR status parsed; no node without evidence; parse-failure recorded not thrown. API test: scan fixture → candidates present with evidence.
  Learner check: Scan the demo fixture, open Principles, click a candidate, and confirm the excerpt matches the real file at those lines.
  Commit: `feat: deterministic discovery with source evidence`

- [ ] **3. Approvals are user actions that persist and never mix with machine candidates**
  Becomes usable: Approve / edit+approve / reject / mark uncertain on candidates; approved rules are visually and structurally distinct; everything survives a server restart; history records the action.
  Why now: The kernel's authority boundary — user-approved vs machine-inferred — must be real in the data model before graph, pack, or checks consume it.
  PRD ref: `prd.md > Principles and decisions review`, `prd.md > States and Boundaries` (persistence)
  Spec ref: `spec.md > Approval service`, `spec.md > Data Model`
  Build: `approvals.ts` (status transitions + attribution + history), Principles view actions + approved/candidate visual distinction, restart persistence test.
  Verify (mechanical): vitest: approve → restart store → still `user-approved`; rejected stays rejected after re-scan of unchanged files; history row written; candidate never auto-upgrades.
  Learner check: Approve a principle, restart the app, confirm it's still approved and visually distinct.
  Commit: `feat: user approvals with history and persistence`

- [ ] **4. The graph is navigable from rule to evidence and back**
  Becomes usable: Graph view: cytoscape canvas + searchable list with type/status filters; select a node → detail panel with linked nodes, source paths/lines, status/confidence; click-through navigation between nodes.
  Why now: The graph is the product's namesake surface — it must be walkable before instruction generation and change checks build on its links.
  PRD ref: `prd.md > Knowledge graph`
  Spec ref: `spec.md > Graph store`, `spec.md > Web UI`
  Build: Graph view (canvas + list + filters + focus-on-neighborhood), node detail panel, evidence click-through, graph read API. Edges only from evidence or user curation.
  Verify (mechanical): API test: every edge has evidence or user origin; no dangling node references; neighborhood filter returns only connected subgraph. UI renders nodes from fixture scan.
  Learner check: Walk from an approved principle to a decision to its source evidence, and back, using both canvas and list.
  Commit: `feat: navigable evidence-linked knowledge graph`

- [ ] **5. The instruction pack generates, previews, and never silently overwrites**
  Becomes usable: Instruction Pack view: deterministic AGENTS.md-style pack from approved content — purpose, principles, conventions, decisions+status, procedures, source pointers, uncertainty notes — with preview, copy, download, export with overwrite warning, and generation metadata.
  Why now: First agent-facing output; depends on approvals (slice 3) and graph structure (slice 4), and is safe to export before diff machinery exists.
  PRD ref: `prd.md > Instruction pack`
  Spec ref: `spec.md > Instruction pack generator`
  Build: `pack.ts` (deterministic assembly + fingerprint + secret exclusion), preview/copy/download endpoints, export with AGENTS.md existence check + explicit overwrite confirm in UI.
  Verify (mechanical): Pack content test: contains approved rules with source pointers, excludes rejected/candidates from the approved section (labeled separately if included), contains no secret-looking content; overwrite path requires `confirm=true`; same graph input → identical output (deterministic).
  Learner check: Generate the pack on the fixture, copy it, and export it — confirm the existing AGENTS.md warning appears.
  Commit: `feat: deterministic instruction pack with safe export`

- [ ] **6. Change check turns a real diff into evidence-backed findings**
  Becomes usable: Change Check view: capture the opened repo's git diff (staged/unstaged) or paste one; see changed files/hunks with secret redaction; applicable rules matched; findings with severity, certainty label, both-side evidence, recommendation, blocking flag; scoped no-findings banner.
  Why now: The demo's money shot — and the last kernel capability. Depends on approvals + graph links existing.
  PRD ref: `prd.md > Change check`, `prd.md > Findings`
  Spec ref: `spec.md > Diff + change checker`, `spec.md > Data Model` (review_runs, findings)
  Build: `diff.ts` (git CLI capture + parse-diff + redaction), `checker.ts` (rule matching via governs/edges/patterns; deterministic checks: prohibited patterns, path restrictions, required-test presence, status contradictions), findings view + review run persistence.
  Verify (mechanical): vitest: a fixture diff adding a direct DB call in a service, against an approved repository-layer principle, yields a finding citing the rule + hunk with correct certainty tier; redaction masks secret-looking values; deterministic check failure labeled `deterministic`, distinct from advisory.
  Learner check: Stage the fixture's violating change, run Change Check, and read the finding's evidence on both sides.
  Commit: `feat: evidence-backed change check with findings`

- [ ] **7. P0 gate: the whole loop passes end to end on the synthetic fixture**
  Becomes usable: `npm run fixture` creates the labeled synthetic demo repo (approved-principle fixture, unapproved candidate, pending violating diff); the full loop runs in one continuous pass with all seven views honest — empty states, error states included. The P0 acceptance gate from the master prompt.
  Why now: Master prompt §4 forbids maintenance work before this gate passes; it's also the demo's exact path.
  PRD ref: `prd.md > The Core Journey`, `prd.md > What We're Building`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Important Failure Modes`
  Build: `scripts/make-fixture.ts` (synthetic repo generator with reset), full-loop API e2e test (open → scan → approve → graph → pack → diff check → finding), empty-repo and invalid-path states, UI pass across all seven views.
  Verify (mechanical): Full-loop e2e green; empty repo scan → honest empty state; invalid path → clear error; fixture regeneration resets cleanly.
  Learner check: Run the fixture, complete the whole loop in the browser yourself, and say where it confused you.
  Commit: `feat: P0 loop acceptance with synthetic fixture`

- [ ] **8. Maintenance: refresh updates records; stale and conflicting knowledge surfaces honestly**
  Becomes usable: Maintenance view: manual refresh (primary) + opt-in watcher; changed/deleted files re-parse and affected evidence flags `possibly stale` without touching approvals; conflict candidates (missing references, dated-status vs newer evidence, supersession chains) show both sources side-by-side and resolve only by user action.
  Why now: Master prompt §4 sequencing: only after the P0 gate passes. Watcher on OneDrive is best-effort; manual refresh is the guaranteed path.
  PRD ref: `prd.md > Maintenance (built strictly after the core loop passes)`
  Spec ref: `spec.md > Watcher + maintenance detector`
  Build: `watcher.ts` (chokidar opt-in + debounce), `maintenance.ts` (stale/conflict detection with explicit states), maintenance flags + resolution store, Maintenance view (side-by-side evidence, dismiss/resolve with note).
  Verify (mechanical): vitest: edit a tracked file → affected evidence flagged, approval unchanged; delete referenced file → stale flag; plant conflicting decisions → both sides shown, no auto-resolution; refresh preserves user resolutions.
  Learner check: Edit a fixture file outside the app, hit refresh, and resolve the staleness finding.
  Commit: `feat: refresh and stale-conflict detection`

- [ ] **9. Ship-ready: verified, polished, documented honestly**
  Becomes usable: `npm run demo` produces the recordable experience; README tells the truth; capability ledger (PROJECT_STATUS) matches reality; docs (VISION/ARCHITECTURE/ROADMAP/MVP-PLAN) present; repo discipline files current; full suite green.
  Why now: Everything before this is capability; this slice makes it a submission.
  PRD ref: `prd.md > States and Boundaries`, `prd.md > Non-Goals` (honesty)
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`
  Build: README (install/run/behavior/limitations/tests), docs/*, PROJECT-STATUS/SESSION-STATE/NEXT-TASKS/USER-THING-TO-DO + doc-of-journey/weeks records per master prompt §6, UI polish pass (states, keyboard, contrast), `npm run demo` end-to-end dry run.
  Verify (mechanical): `npm test` full suite green; `npm run build` clean; demo dry run recorded in PROJECT_STATUS with observed results.
  Learner check: Watch/record the demo flow once and flag anything you wouldn't want a judge to see.
  Commit: `docs: honest ship-ready state with verified ledger`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 3 (approve → restart → still approved), learner tries the approval loop in the browser
- [ ] Final kick-the-tires exploration and feedback completed — after slice 9, learner walks the full demo flow

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [pending]
Route and stops: [pending]
Edit outcome: [pending]
Reflection: [pending]
Activity mode: [pending]

## Revisions
