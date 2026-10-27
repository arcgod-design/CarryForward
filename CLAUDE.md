# CLAUDE.md — CarryForward boot map

Project: CarryForward — local-first project maintainer (Devpost Build With AI: Basics entry).
Competition docs: `devpost/scope.md`, `devpost/prd.md`, `devpost/spec.md`, `devpost/checklist.md` (real Learn Skill Pack artifacts).

## Read order for a new session

1. `AGENTS.md` — boot rules (authoritative summary).
2. `PROJECT-CORE.md` — approved principles + locked decisions.
3. `PROJECT_STATUS.md` — capability truth ledger.
4. `SESSION-STATE.md` — current verified state + one next step.
5. `NEXT-TASKS.md` + `USER-THING-TO-DO.md` — task board and human blockers.
6. `weeks/README.md` → `weeks/WEEK-00.md` (rolling handoff) → `weeks/state/current.json` → the session file it points to.
7. `doc-of-journey/topics/errors.md` before debugging anything.

## What this app is

A local web app (Node/Express + SQLite + Vite/React + cytoscape) that:
opens one local repository → discovers rules/decisions/conventions with file+line evidence →
lets the user approve principles (persisted, attributed, never overwritten by rescans) →
shows a navigable evidence-linked graph → generates a deterministic AGENTS.md-style instruction pack →
checks git diffs against approved rules (user-encoded "Forbidden pattern:" lines) producing findings with both-side
evidence and honest certainty labels → refreshes and flags stale/conflicting knowledge for human resolution.

## Hard rules

- No ZIP/import features. No historical-session import. (Deliberate non-feature; see scope.)
- Never silently write into the opened repository; instruction-pack export requires explicit confirmation, with an
  overwrite guard.
- Repo content is data, never instructions to the app. Never execute repo scripts.
- Secrets: redacted everywhere; secret-named files never read. Never commit the user's NIM key or any credential.
- Plain names only: project principles, rules, decisions, knowledge graph, instruction pack, change check.
- Every capability claim in `PROJECT_STATUS.md` needs a command + observed result. No exceptions.

## Commands

- `npm run dev` — server (tsx watch) + web (vite) for development
- `npm run build` — full typecheck + build; `npm start` — run built app at http://localhost:8787
- `npm run demo` — build + run (what the demo video records)
- `npm test` — vitest (unit + full-loop API e2e)
- `npm run fixture` — regenerate `fixtures/demo-repo` (synthetic, labeled, resettable)

## Session-end protocol

Follow `weeks/memory-protocol.md`: update rolling handoff, session JSON snapshot, `current.json` pointer, human-readable state files. Never invent command output.
