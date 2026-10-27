# MVP-PLAN.md

The individual-first must-work loop and its pass/fail criteria (from the master prompt §10, proven by `server/src/e2e.loop.test.ts` + live checks; all criteria PASS as of 2026-10-27).

## The loop under test

Open a real local repository → discover instruction/decision/convention files with source evidence → the user approves at least one principle → the graph contains connected records navigable to their evidence → generate and export an instruction pack that respects existing files → inspect a real git diff against relevant rules → produce at least one evidence-backed finding with explicit uncertainty → everything persists across restart.

## Pass/fail results

- **PASS — Open real repository:** e2e opens the git-initialized synthetic fixture; live checks opened fixture and scratch repos (Project view, validated path, identity + scan state displayed).
- **PASS — Discovery with evidence:** e2e asserts the repository-layer candidate at `PROJECT-CORE.md:7 (explicit-rule, confidence high)` with exact excerpt; ADR status parsing asserted in extractor tests.
- **PASS — User approves ≥1 principle:** e2e approves (with edit) via the review endpoint; approvals tests cover reject/uncertain/edit+approve/deprecate + attribution + history.
- **PASS — Navigable graph:** graph tests assert governs/verified_by/supersedes edges wired to evidence; UI provides canvas + list + detail + focus (built; exercised in live UI boot).
- **PASS — Instruction pack respects existing files:** 409-on-existing + explicit overwrite confirm + alternative filename, all observed live (2026-10-27).
- **PASS — Real diff inspected:** live check ran `git diff` in a real git repo; e2e runs it against the fixture's pending violating change.
- **PASS — Evidence-backed finding with uncertainty:** live: `prohibited-pattern / deterministic / blocking`, rule evidence `AGENTS.md:5 (explicit-rule, confidence high)`, changed evidence `src/services/user-service.ts:3 — db.query(...)`; certainty tiers (strong-evidence missing-test, needs-human-review status-evidence) unit-tested.
- **PASS — Persistence across restart:** approvals + findings + dispositions verified across DB reopen and full server restart (approvals tests, checker test, e2e restart case).
- **PASS — Maintenance acceptance (after the P0 gate):** stale flags on file-missing/file-changed with approvals preserved; ADR conflict with both sides; dismissal persistence; watcher observed end-to-end live (edit → auto-refresh → new rule appears).

## Tests backing the plan

`npx vitest run` → 72/72 across 10 files: scanner (6), secrets (12), store (5), extractor/graph (14), approvals (9), pack (5), checker (8), maintenance (5), e2e full loop (8). `npm run build` → server + web typecheck + vite build, clean.

## Non-goals held

No ZIP import, no historical-session import, no accounts/cloud, no AI-key dependency, no auto-commit/push, no hard-coded demo findings (the fixture drives the same pipeline as any repo; e2e proves it through the real API).
