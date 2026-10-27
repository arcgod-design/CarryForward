# PROJECT_STATUS.md

Capability truth ledger. Labels: `WORKING` (observed command + result), `PROTO` (partially working or unverified in full), `ROADMAP` (planned, not built). Updated 2026-10-27.

## Capability ledger

- **WORKING — Repository open + validated scan** (`server/src/scanner.ts`): stays inside root, visible exclusions with reasons, secret-named files never read, symlinks skipped, caps with truncation notice.
  Evidence: `npx vitest run` → 72/72 passed (scanner, secrets, store, extractor, graph, approvals, pack, checker, maintenance, e2e suites), 2026-10-27. Live API: scan of synthetic fixture returned parsed files + discovery counts (slice-1 and slice-7 checks, observed 2026-10-26/27).

- **WORKING — Discovery with evidence** (`server/src/extractor.ts`, `graph.ts`): file-role recognition, rule-language extraction with exact line numbers/excerpts/classification, ADR parsing (number/status/decision section/supersedes), package.json procedures/dependencies, config conventions, components, evidence-backed governs/supersedes/verified_by edges.
  Evidence: extractor tests assert exact line evidence; e2e asserts `PROJECT-CORE.md:7 (explicit-rule, confidence high)`.

- **WORKING — Principles review + approvals** (`server/src/approvals.ts`): approve/edit-approve/reject/uncertain/deprecate with `local-user` attribution + history; survives DB reopen and full server restart; rescan preserves user-touched nodes.
  Evidence: approvals tests + live check `candidate → user-approved → restart → rescan → still user-approved` (2026-10-26).

- **WORKING — Knowledge graph + navigation** (`web/src/views/GraphView.tsx`): cytoscape canvas + searchable/filterable list, focus-on-neighborhood, detail panel with evidence, click-through connected nodes, user link creation/removal (evidence-backed discovered links protected), `graph.json` export.
  Evidence: graph tests (edges evidence-backed or user-origin; governs/verified_by/supersedes wiring; rescan idempotence; dangling-edge check = 0).

- **WORKING — Instruction pack** (`server/src/pack.ts`): deterministic (same graph state → identical bytes), approved-only binding sections, candidate counts disclosed, secret exclusion, fingerprint, preview/copy/download, export with 409 overwrite guard + alternative filename.
  Evidence: pack tests; live check: overwrite blocked HTTP 409 (correct), alternative file written, original AGENTS.md untouched (2026-10-27).

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

## Verification commands (run 2026-10-27)

- `npx vitest run` → **72 passed (72)** across 10 test files.
- `npm run build` → tsc (server + web `--noEmit`) + vite build → clean (`✓ built in ~4s`).
- `npm run fixture` → synthetic fixture regenerated.
- Live server checks (boot → open → scan → approve → pack → export → check → finding → refresh → watch) → all observed as recorded above.

## Known limitations

- Discovery heuristics are deliberately conservative; unusual doc formats may yield no candidates (shown honestly as empty states, never guessed).
- Prohibited-pattern checks fire only for patterns the user explicitly encodes (`Forbidden pattern: <regex> in <path-prefix>`); prose rules are advisory context, not mechanical checks.
- `parse-diff` handles standard unified diffs; binary/renamed hunks may be skipped.
- Scanner caps: 5000 listed files, depth 12, 512KB per file, 4000 dirs — partial results are labeled `truncated`.
- English-language heuristics only (rule words, status markers).
