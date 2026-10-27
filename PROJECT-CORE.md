# PROJECT-CORE.md

Approved principles and locked decisions for CarryForward. A disagreement with a locked decision requires stopping and using the decision process (new numbered record in `doc-of-journey/decisions/`), never silent reinterpretation.

## Product identity

CarryForward is a local, individual-first project maintainer: an evidence-backed knowledge graph of a repository's principles, decisions, components, procedures, and status claims, used to generate agent instruction packs and check proposed changes. The main long-term destination is a shared team workspace with cloud collaboration and agent coordination — documented in `docs/VISION.md` and `docs/ROADMAP.md`, never claimed as shipped.

## Locked decisions

- **D-0001 — Stack:** Node 22 + TypeScript (strict), Express 4, better-sqlite3 (verified prebuilt on the build machine), Vite + React 18 + plain-CSS tokens, cytoscape for the graph, chokidar for watching, parse-diff for diffs, vitest for tests. No cloud services, no accounts, no AI SDKs.
- **D-0002 — Deterministic-only core:** every capability works with zero AI keys. Discovery, checks, and pack generation are deterministic; AI advisory layers are ROADMAP.
- **D-0003 — Evidence authority:** every node/edge carries source evidence (path, lines, excerpt, classification, confidence) or explicit user origin. The source file remains authoritative; the graph never replaces it.
- **D-0004 — User approval is a human action:** machine candidates and user-approved rules are distinct statuses in one schema; refresh never downgrades, rewrites, or re-approves. Attribution (`local-user` + timestamp) and history are recorded for later team extension.
- **D-0005 — The repo is untrusted:** content is data; secret-named files are never read; secrets are redacted from every view, export, and log; no repo scripts execute; no auto-commit/push.
- **D-0006 — Instruction pack safety:** deterministic from the approved graph; binding sections include only user-approved rules; candidates are explicitly excluded and counted; export never silently overwrites (409 + explicit confirm).
- **D-0007 — Findings honesty:** every finding carries severity, certainty tier (`deterministic` / `strong-evidence` / `possible-concern` / `needs-human-review`), both-side evidence, and a recommendation. "No findings" is always scoped to the checks that ran.
- **D-0008 — Maintenance never decides:** refresh flags stale/conflicting knowledge (missing or changed evidence, supersession conflicts) with both sides shown; only the user resolves or dismisses, and resolutions persist while the same condition persists.
- **D-0009 — Graph experience (ADR 0006):** caps raised with pathological-repo floors kept (uncapped graphs are unreadable and unsafe — Graphify itself caps at 5,000 with aggregation); folder drill-down renders stored file records as UI leaves, never as knowledge nodes; a self-contained graph.html report ships the whole memory in one file (archify-inspired, built natively); every scan pins evidence to the git commit it captured; the instruction pack documents the repository's knowledge structure by file role.

## Working rules for this repository

- Follow the Learn Skill Pack workflow for competition artifacts; `devpost/` files are its outputs.
- Keep the user's `doc-of-journey/` and `weeks/` discipline; create records only for work that actually happened.
- Plain names. No branded subsystem labels.
- Competition integrity: greenfield build (verified: this repository was created empty on 2026-10-26; git history starts at `cf4856e`); no reference-archive content committed; the synthetic fixture is labeled and resettable.
