# PROJECT_STATUS.md

Capability truth ledger. Labels: `WORKING` (observed command + result), `PROTO` (partially working or unverified in full), `ROADMAP` (planned, not built). Updated 2026-10-27 (session 2: graph experience upgrades).

## Capability ledger

- **WORKING — Repository open + validated scan** (`server/src/scanner.ts`): stays inside root, visible exclusions with reasons, secret-named files never read, symlinks skipped, caps with truncation notice.
  Evidence: `npx vitest run` → 72/72 passed (scanner, secrets, store, extractor, graph, approvals, pack, checker, maintenance, e2e suites), 2026-10-27. Live API: scan of synthetic fixture returned parsed files + discovery counts (slice-1 and slice-7 checks, observed 2026-10-26/27).

- **WORKING — Discovery with evidence** (`server/src/extractor.ts`, `graph.ts`): file-role recognition, rule-language extraction with exact line numbers/excerpts/classification, ADR parsing (number/status/decision section/supersedes), package.json procedures/dependencies, config conventions, components, evidence-backed governs/supersedes/verified_by edges.
  Evidence: extractor tests assert exact line evidence; e2e asserts `PROJECT-CORE.md:7 (explicit-rule, confidence high)`.

- **WORKING — Principles review + approvals** (`server/src/approvals.ts`): approve/edit-approve/reject/uncertain/deprecate with `local-user` attribution + history; survives DB reopen and full server restart; rescan preserves user-touched nodes.
  Evidence: approvals tests + live check `candidate → user-approved → restart → rescan → still user-approved` (2026-10-26).

- **WORKING — Knowledge graph + navigation** (`web/src/views/GraphView.tsx`): cytoscape canvas + searchable/filterable list, focus-on-neighborhood, detail panel with evidence, click-through connected nodes, user link creation/removal (evidence-backed discovered links protected), `graph.json` export, **expandable folder nodes** (double-click a component → its recorded files render as rectangle leaves; click a file → the knowledge extracted from it; UI overlay of stored records, not knowledge nodes), curated default canvas (dependencies + unconnected hidden behind a toggle), zoom-gated labels + hover labels, canvas legend.
  Evidence: graph tests (edges evidence-backed or user-origin; governs/verified_by/supersedes wiring; rescan idempotence; dangling-edge check = 0; dot/generated dirs excluded); live: learner's real 330-node repo now renders 8 connected knowledge nodes by default (2026-10-27).

- **WORKING — Standalone graph.html report** (`server/src/report.ts`): one endpoint emits a single self-contained HTML (cytoscape inlined, embedded JSON with `<` escaped, zoom-gated labels, legend, evidence panel, folder file lists, file→knowledge drill-through, commit pin in header). Archify-inspired pattern, built natively — nothing copied.
  Evidence: report tests (self-contained artifact, JSON payload parse, commit pin in header); live: learner's repo generated a 3.2 MB report verified to contain the embedded payload and commit `a5ea5a15…` (2026-10-27).

- **WORKING — Commit pinning** (`server/src/diff.ts currentCommit()`): every scan/refresh records `git rev-parse HEAD` on the project; pack and report state which commit evidence was captured at; null (honest) for non-git folders.
  Evidence: commit-pinning test; live: aws project pinned to `a5ea5a156f2c…` (2026-10-27).

- **WORKING — Instruction pack** (`server/src/pack.ts`): deterministic (same graph state → identical bytes), approved-only binding sections, candidate counts disclosed, secret exclusion, fingerprint, **"Repository knowledge structure" section** (discovered instruction/core/status/decision/topic files grouped by role with guidance), preview/copy/download, export with 409 overwrite guard + alternative filename.
  Evidence: pack tests (determinism, structure section, commit pin line, role grouping); live check: overwrite blocked HTTP 409 (correct), alternative file written, original AGENTS.md untouched (2026-10-27).

- **WORKING — Change check + findings** (`server/src/diff.ts`, `checker.ts`): real `git diff` (unstaged/staged/HEAD) or pasted diff, parse-diff, secret redaction in diff display, user-encoded `Forbidden pattern:` rules (path-scoped), required-test presence, status-evidence watch; findings with certainty tiers, both-side evidence, recommendations, blocking flag, dispositions persisted.
  Evidence: checker tests; live check on real git repo: `1 finding across 1 changed file`, kind=prohibited-pattern, certainty=deterministic, blocking=True, rule evidence `AGENTS.md:5 (explicit-rule, confidence high)`, changed evidence `src/services/user-service.ts:3 — db.query(...)`, disposition fixed persisted, server stable (2026-10-27).

- **WORKING — Maintenance: refresh + stale/conflict detection** (`server/src/maintenance.ts`): refresh rescans, reports changed/deleted files, flags (a) evidence file missing, (b) evidence file changed (content hash), (c) ADR supersession conflicts — both sides with dates/reasons shown; user-only resolve/dismiss with notes; dismissals persist while the same signature recurs; user-approved nodes never rewritten.
  Evidence: maintenance tests (5/5); live check: ADR 0002 vs 0001 conflict flagged with both sides on the regenerated fixture (2026-10-27).

- **WORKING — File watcher (best-effort)** (`server/src/watcher.ts`): chokidar, ignored dirs, ~1.5s debounce + awaitWriteFinish, opt-in start/stop, honest error surface, manual refresh always available.
  Evidence: live check — edit to PROJECT-CORE.md detected (`change PROJECT-CORE.md`), debounced refresh ran, newly added rule appeared in the graph without manual action (2026-10-27). Caveat: primary path is manual refresh; OneDrive-synced folders may produce duplicate/delayed events.

- **WORKING — Synthetic demo fixture** (`scripts/make-fixture.ts`): labeled synthetic repo (principles, ADR + controlled conflict pair, status claims, procedures/dependencies, compliant + violating code, pending unstaged violating change), git-initialized, resettable via `npm run fixture`.
  Evidence: `npm run fixture` run twice (2026-10-27): files present, `git status` shows only the intended unstaged modification.

- **WORKING — P0 core loop end to end** (`server/src/e2e.loop.test.ts`): open → discover → approve (with pattern edit) → pack generate/export → graph export → check → deterministic finding → disposition → restart persistence → empty-repo and invalid-path honesty.
  Evidence: part of `npx vitest run` 72/72, 2026-10-27.

- **PROTO — None currently.** (No capability is deliberately half-shipped; the watcher is labeled WORKING with a documented best-effort caveat rather than PROTO because it was observed working end to end.)

## ROADMAP (documented, not built — see docs/ROADMAP.md)

- Team workspaces, accounts, permissions, shared approval history, cloud sync.
- Agent-facing retrieval endpoint (beyond graph.json export) and agent orchestration.
- AI-assisted classification as an optional advisory layer with explicit provider consent.
- Framework/AST-level code parsing (the current discovery is docs/config/structure-based by design).

## Verification commands (run 2026-10-27, session 2)

- `npx vitest run` → **79 passed (79)** across 11 test files (added: report suite; extended: pack structure, commit pinning, component noise exclusion).
- `npm run build` → tsc (server + web `--noEmit`) + vite build → clean.
- Live: server restart with new build; learner's aws project refresh picked up **100 previously truncated files** under the raised caps (20,000 files / depth 16 / 8,000 dirs); commit pin recorded; 3.2 MB graph.html generated and verified (payload + pin + project name embedded).
- Caps raised per ADR 0006: scanner 20,000/16/8,000 (was 5,000/12/4,000), extractor 1,500/400/50 (was 400/120/20), components top 50.

## Known limitations

- Discovery heuristics are deliberately conservative; unusual doc formats may yield no candidates (shown honestly as empty states, never guessed).
- Prohibited-pattern checks fire only for patterns the user explicitly encodes (`Forbidden pattern: <regex> in <path-prefix>`); prose rules are advisory context, not mechanical checks.
- `parse-diff` handles standard unified diffs; binary/renamed hunks may be skipped.
- Scan caps (20,000 listed files, depth 16, 512KB per file, 8,000 dirs) — raised from the original defaults per ADR 0006; hard floors remain because uncapped rendering/reading of pathological repos is unsafe (Graphify itself aggregates above 5,000 rendered nodes).
- The canvas curates by default (dependencies and unconnected nodes behind the "Show all nodes" toggle) — the full record set always lives in the list view and exports.
- AST/symbol-level code graphs (tree-sitter) are ROADMAP (ADR 0005): discovery is docs/config/structure-based by design.
- English-language heuristics only (rule words, status markers).
- The graph.html report is a static snapshot of the last scan; it does not re-scan or live-sync.
