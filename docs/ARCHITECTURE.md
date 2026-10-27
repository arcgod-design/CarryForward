# ARCHITECTURE.md

Current implemented architecture (2026-10-27). Future design is marked explicitly; nothing unmarked is aspirational.

## Shape

One Node process, two artifacts:

```
Browser (web/ — Vite + React 18 + plain-CSS tokens)
   │  fetch /api/*  (JSON; same-origin; vite proxy in dev)
   ▼
Express app (server/src/index.ts → routes.ts)
   ├── scanner.ts      safe bounded walk, exclusions, hashes
   ├── extractor.ts    deterministic parsing → candidates + evidence
   ├── graph.ts        evidence-backed nodes/edges (stable IDs)
   ├── approvals.ts    review workflow + attribution + history
   ├── pack.ts         deterministic instruction pack + fingerprint
   ├── diff.ts         git capture (execFile) + parse-diff + redaction
   ├── checker.ts      rule matching + deterministic checks → findings
   ├── maintenance.ts  refresh + stale/conflict detection
   ├── watcher.ts      chokidar opt-in watcher (best-effort)
   ├── secrets.ts      secret patterns + redaction
   ├── store.ts        data-access boundary (all SQL lives here)
   └── db.ts           better-sqlite3 + sequential migrations (user_version)
   ▼
SQLite file: data/carryforward.db (gitignored; one file, WAL mode)
```

## Deliberate boundaries

- **Store boundary:** every table lives behind `store.ts`. The spec's fallback plan (JSON file store if better-sqlite3 ever fails on a machine) requires swapping only that module.
- **Parsing / graph / policy separation:** extractor never touches the DB; graph construction is pure (nodes/edges/evidence in, records out); checker reads records and diffs, never re-parses repo files.
- **Approval boundary:** `approvals.ts` is the only writer of user-status changes; scans and refreshes cannot modify user-touched nodes (they flag, never write).
- **Trust boundary:** repository content is data. The only executed external command is `git diff` via `execFile` with a fixed arg list — no shell interpolation, no repo scripts.
- **Future (designed-for, not built):** stable UUIDs for every entity; `approved_by/approved_at` + history rows ready to carry team identities; a retrieval endpoint can wrap the same store without touching graph/pack/checker logic.

## Data model (implemented)

`projects`, `source_files` (hash/mtime/parse status/skip reason), `evidence` (path, lines, excerpt, classification, confidence, content_hash), `nodes` (8 types, status, origin, user_touched, supersedes), `edges` (7 relations, evidence_id or user origin), `packs`, `review_runs` + `findings` (certainty tiers, dispositions), `maintenance_flags` (kind, both-sides details, signature, resolution), `history` (entity, action, actor, detail).

Migrations are sequential strings in `db.ts`, applied via `PRAGMA user_version` on first open; tests and live boots verified all migrations idempotent.

## What the UI assumes

The server is the single source of truth; views refetch after every action. Repo excerpts render as **escaped plain text** (never HTML) — repo content cannot execute anything. Graph canvas (cytoscape) always has a parallel list/search/filter view; the canvas is never the only route to information.

## Known sharp edges (honest)

- Scanner caps (5000 files / depth 12 / 512KB / 4000 dirs) — partial results labeled `truncated`.
- parse-diff consumes standard unified diffs; rename/copy hunks may be skipped.
- Chokidar on OneDrive-synced folders can duplicate/delay events; debounce + awaitWriteFinish mitigates; manual refresh is the guaranteed path.
- English-language heuristics for rule/status extraction.
