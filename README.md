# CarryForward

A local-first project maintainer for developers working with AI coding agents. CarryForward turns a repository's scattered rules, decisions, and conventions into an **evidence-backed knowledge graph**, generates a project-specific **agent instruction pack** from your approved rules, and **checks proposed changes** against them — citing the exact source lines on both sides.

Built for the Devpost **Build With AI: Basics** hackathon using the Devpost Learn Skill Pack (`devpost/scope.md`, `prd.md`, `spec.md`, `checklist.md` are the skill's real artifacts).

## The problem it solves

Your project's rules live everywhere and nowhere: `AGENTS.md`, `CLAUDE.md`, decision records, status docs, CONTRIBUTING files. Coding agents miss them, follow stale guidance, or repeat past mistakes — because the reasons and constraints are scattered across files and conversations. CarryForward keeps that knowledge **connected to the repository**, **reviewable by you**, and **operational for agents and change checks**.

## What it does (all verified — see PROJECT_STATUS.md)

1. **Open a repository** — validated path, scan bounded to the selected root, visible exclusions (`.git`, `node_modules`, `.env*`, key files are never read), honest empty/error states. Nothing leaves your machine.
2. **Discover with evidence** — deterministic parsers recognize instruction files, project-core/status docs, decision records (ADRs), manifests, configs, and structure. Every candidate principle carries its **source path, line range, excerpt, classification, and confidence**. Code demonstrates what exists; nothing becomes a rule until you approve it.
3. **Approve principles** — machine candidates and user-approved rules are structurally distinct. Approve, edit-then-approve, reject, mark uncertain, or write your own. Every action is attributed and survives restarts and rescans — refresh never rewrites your approvals.
4. **Browse the graph** — a small typed graph (principles, decisions, components, conventions, procedures, dependencies, verifications, status questions) with evidence-backed links only. Navigable canvas + searchable list, filters, focus view, and a `graph.json` export. **Double-click a folder node to expand its files** — each file leaf shows the knowledge extracted from it — and download **graph.html**: a self-contained, interactive snapshot of the whole project memory (cytoscape inlined, works offline, send it to anyone).
5. **Generate the instruction pack** — a deterministic AGENTS.md-style file from your approved rules with source pointers, decisions and their status, verification procedures, uncertainty notes, and a **repository knowledge-structure section** (where the project's decision records, status ledgers, and topic memory live, by file role). Unreviewed machine candidates are deliberately excluded and counted. Export never silently overwrites an existing instruction file. Evidence is **pinned to the git commit** it was captured at.
6. **Check changes** — read the repo's real git diff (staged/unstaged/HEAD) or paste one. Approved rules can encode **`Forbidden pattern: <regex> in <path>`** lines for deterministic checks; missing-test presence and status-evidence changes are flagged too. Every finding shows severity, an honest certainty label (`deterministic` / `strong evidence` / `possible concern` / `needs human review`), evidence on both sides, and a recommended action. "No findings" is always scoped: only the checks that ran found nothing.
7. **Maintain the knowledge** — refresh re-parses changed files and flags **stale evidence** (file gone or changed) and **conflicting decisions** (e.g., ADR 0002 supersedes ADR 0001 while 0001 still says "accepted") — both sides shown, resolved only by you. An opt-in file watcher (best-effort) triggers refreshes; manual refresh always works.

## Quick start

```powershell
npm install
npm run fixture     # create the synthetic demo repository (fixtures/demo-repo)
npm run demo        # build + start → http://localhost:8787
```

Open http://localhost:8787, enter the absolute path to `fixtures/demo-repo`, scan it, approve the repository-layer principle (add the `Forbidden pattern:` line as shown in the Principles view hint below), then run Change Check — the fixture ships with a pending violating diff.

For development: `npm run dev` (server + web hot-reload). Tests: `npm test` (79 tests, including a full-loop end-to-end run against the fixture). Reset the demo any time with `npm run fixture`.

## Requirements

Node.js ≥ 20, npm, git on PATH (for change check). Windows/macOS/Linux. **No API keys, no accounts, no cloud.**

## Architecture

Express + better-sqlite3 backend (`server/src`), Vite + React + plain-CSS frontend (`web/src`), shared domain types (`shared/types.ts`). One local SQLite file under `data/` (gitignored) holds projects, files, evidence, nodes, edges, packs, review runs, findings, flags, and history. The store sits behind a small data-access boundary so a JSON backend could replace it. See `docs/ARCHITECTURE.md`.

## Security posture

- Scans never leave the selected root; symlinked paths are not followed; secret-named files (`.env*`, keys, credentials) are never read.
- Secret-looking values are redacted from every view, export, and log.
- Repository content is untrusted data. No repo scripts ever execute. No auto-commit/push. The only write into your repository is an instruction-pack export you explicitly confirm, with an overwrite guard.
- The app's own reset removes its index only — never your files.

## Third-party tools and attribution

- **Code Graph** runs the [graphify](https://github.com/Graphify-Labs/graphify) CLI (open source, Apache-2.0/MIT) inside your repository and serves its `graphify-out/graph.html` unmodified. Install: `uv tool install graphifyy`, then `graphify install`.
- **Diagrams** are implemented natively; the interactive-diagram pattern is inspired by [archify](https://github.com/tt-a1i/archify) (open source, Apache-2.0/MIT). No third-party code is vendored.
- Disclosure: per competition rules, all incorporated third-party work is attributed here and in `doc-of-journey/decisions/0006` and `0007`.

## Limitations (honest)

- Discovery is deliberately conservative; unusual documentation formats may produce no candidates (honest empty states, no guessing). Heuristics are English-language.
- Mechanical pattern checks fire only for patterns you explicitly encode; prose rules appear as applicable-rule context, not fake enforcement.
- The watcher is best-effort (OneDrive-synced folders can duplicate/delay events); manual refresh is the guaranteed path.
- Scan caps (20,000 files, depth 16, 512KB/file, 8,000 dirs) protect against runaway scans; partial results are labeled. The canvas curates by default (dependencies/unconnected behind a toggle) — the list view and exports always hold the full set.
- AST/symbol-level code graphs are roadmap; discovery is docs/config/structure-based by design.
- graph.html is a static snapshot of the last scan — it does not re-scan.

## Long-term vision

CarryForward's destination is a **shared team workspace**: accounts, permissions, versioned decisions with review history, agents consuming one project knowledge base, cloud sync with explicit data boundaries. None of that is built here; the data model (stable IDs, provenance, approval attribution, storage boundary) is shaped so it can be. See `docs/VISION.md` and `docs/ROADMAP.md`.

## License

TBD — chosen by the maintainer (tracked in USER-THING-TO-DO.md).

## Competition provenance

Greenfield build started from an empty folder during the submission period (git history begins at the initial scan commit on 2026-10-26). Planning documents in `devpost/` were produced by the Devpost Learn Skill Pack (`npx skills add challengepost/learn-ai-basics`). The demo repository under `fixtures/` is synthetic, clearly labeled, and resettable.
