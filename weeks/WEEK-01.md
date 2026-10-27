# WEEK-01.md — Build and ship the individual-first MVP

Status: **DONE** (exit tests passed 2026-10-27; evidence below and in PROJECT_STATUS.md).

## Purpose

Prove the entire P0 loop end to end on a local repository, then add the maintenance layer, then be submission-ready.

## In scope

Slices 1–9 of `devpost/checklist.md` (scan, discovery, approvals, graph, pack, change check, P0 gate e2e, maintenance, ship-readiness).

## Non-goals

Team/cloud features, AI provider integration, AST parsing, ZIP import, auto-commit/push, demo-only code paths.

## Exit tests (all observed)

1. `npx vitest run` → 72 passed (72) across 10 files — includes the full-loop API e2e on the synthetic fixture (open → discover → approve → pack → export → graph → check → deterministic finding → disposition → restart persistence → empty/invalid honesty).
2. `npm run build` → server tsc + web noEmit + vite, clean.
3. Live boot checks: approval survives restart + rescan; pack overwrite guard returns 409 with the original file untouched; real `git diff` yields a deterministic blocking finding citing `AGENTS.md:5 (explicit-rule, confidence high)` and `src/services/user-service.ts:3 — db.query(...)`; refresh flags the fixture's ADR conflict with both sides; watcher end-to-end auto-refreshes after an edit.
4. `npm run fixture` regenerates a clean synthetic demo repo (twice verified).

## Status note

Implementation exit tests passed. Ship items that require the human (license, push approval, video, submission) remain open by design and are tracked in USER-THING-TO-DO.md; the week is DONE for everything the agent could verify.
