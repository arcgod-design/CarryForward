---
doc: spec
status: approved
---
# CarryForward — Technical Spec

## How This Works, In Plain Language

CarryForward is one local program with two parts that talk to each other on your machine and nowhere else:

1. **The server** — a small Node.js process that does all the real work: reads the repository you point it at (staying strictly inside that folder, skipping `.git`, `node_modules`, `.env` files and other places it must not look), pulls candidate rules/decisions/conventions out of the files it recognizes, stores everything in a local SQLite database file next to the app, matches git diffs against the rules you approved, and writes the agent instruction file when you ask.
2. **The web UI** — what you see in the browser: seven views (Project, Overview, Principles, Graph, Instruction Pack, Change Check, Maintenance) that talk to the server over local HTTP.

Nothing leaves the machine. No accounts, no keys, no cloud. The database is a single file you can delete (the app's "reset" does exactly that, without touching your repository). If the SQLite driver ever fails to install on a machine, the storage sits behind one small boundary and can be swapped for a plain JSON file — same data, same features.

Why this shape: the product's whole job is reading local files and keeping honest records about them, so the architecture is deliberately boring — one server process, one local database, one browser UI. Anything fancier (graph database, cloud sync, agent orchestration) would be spending your demo time on infrastructure instead of the core loop.

## The Core Journey Through the System

PRD ref: `prd.md > The Core Journey`.

1. User types a repository path in the **Project** view → server validates it exists and is readable → a project record is stored.
2. User clicks **Scan** → the scanner walks the folder (bounded, exclusion-aware) → each recognized file is parsed by the extractor → candidate principles, decisions, conventions, components, procedures, dependencies, and status claims come back each with evidence (path + line range + excerpt + classification) → all of it is stored with the project.
3. On **Principles**, each candidate's approve/edit/reject/uncertain action goes to the server, which marks the node `user-approved` and records who/when — machine candidates and user approvals live in the same table but never the same status.
4. On **Graph**, the UI asks the server for nodes/edges; cytoscape draws the canvas from that data, and every click opens stored evidence. Edges exist only where extraction produced evidence or the user created them.
5. On **Instruction Pack**, the generator assembles the pack deterministically from approved nodes + provenance → preview → copy/download, or export with an overwrite warning if `AGENTS.md` already exists in the target repo.
6. On **Change Check**, the server runs `git diff` inside the opened repo (via the git CLI, never by executing repo scripts), parses hunks, redacts anything secret-looking, matches changed paths against rule links (governs edges, evidence paths, user-encoded patterns), runs deterministic checks, and stores a review run with findings — each finding carries both sides of the evidence and a certainty label.
7. On **Maintenance** (phase 2), a file watcher or manual refresh re-parses changed files; stale/conflict candidates are flagged with both sources shown side-by-side; nothing is ever auto-resolved.

## Stack

- **Node.js 22 + TypeScript (strict)** — already installed and verified on this machine; the master prompt's own guidance prefers TypeScript with boundary validation.
- **Express 4** for the local HTTP server — boring, stable, everything known. https://expressjs.com/
- **better-sqlite3** for persistence — synchronous, perfect for single-user local tools; stored in one file (`data/carryforward.db`). Fallback if native build fails: same store boundary backed by a JSON file. https://github.com/WiseLibs/better-sqlite3
- **Vite + React 18 + TypeScript** for the UI — fast, standard, and the learner's environment already runs Node tooling. https://vite.dev/
- **cytoscape** for graph rendering — small, mature, built-in layouts, no service dependency. https://js.cytoscape.org/
- **chokidar** for the maintenance-phase watcher, with manual refresh as the always-available fallback (this repo lives on OneDrive, so watcher events may be quirky — honest manual refresh is the primary path). https://github.com/paulmillr/chokidar
- **parse-diff** for parsing `git diff` output into files/hunks. https://www.npmjs.com/package/parse-diff
- **vitest** for tests. https://vitest.dev/
- Git access via `child_process.execFile("git", …)` — zero dependencies, exact commands visible.
- Zero AI/LLM SDKs — the product is deterministic-first by requirement; the learner's OpenCode model key is never used by the app.

Unverified items flagged for early build check: better-sqlite3 prebuilt binary availability for Node 22/Windows (check first thing; JSON fallback if it fails); parse-diff's handling of rename/copy hunks (verify with a real fixture diff).

## Where It Runs and How Someone Tries It

- Runtime: local Node process + the user's browser. Windows/macOS/Linux. No API keys, no accounts, no network beyond `npm install`.
- Requirements: Node ≥ 20, npm, git available on PATH (for change check).
- Install: `npm install`
- Demo mode (what the video records): `npm run demo` → builds the web UI, starts the server on http://localhost:8787, opens the browser. To make the synthetic demo repo: `npm run fixture` (creates `fixtures/demo-repo`, a small labeled git repository with an approved-principle fixture, an unapproved candidate, and a pending violating diff).
- Development: `npm run dev` (server with watch + Vite dev server proxy).
- Tests: `npm test` (vitest, includes API-level end-to-end loop test against a temp fixture repository).
- Deployment: none — submission requires the video + public repo; a local app is explicitly sufficient per competition rules.

## Look and Feel

Implements `prd.md > Look and Feel`. Dark developer-console aesthetic: near-black surface, high-contrast off-white text, monospace (system `Consolas/monospace` stack) for paths, line numbers, and excerpts; a restrained single accent (teal) plus four semantic status colors — approved (green), candidate (amber), inferred/advisory (blue), stale/conflict/deterministic-failure (red). Calm, spacious, keyboard-navigable, real counts only. No gradients, no decorative animation, no chatbot styling. Design tokens in one CSS file; plain CSS (no framework) to keep full control and zero extra build risk.

## Components

### Repository scanner (`server/src/scanner.ts`)
Walks the selected root within bounds; applies visible exclusions; records every file with size/hash/mtime and skip reasons; never follows paths outside the root.
PRD ref: `prd.md > Opening a repository`.

### Extractor (`server/src/extractor.ts`)
Deterministic parsers: known-file-role recognition (AGENTS/CLAUDE/README/decision records/status docs/configs — recognizing whatever the target repo actually uses), rule-language heuristics for candidate principles from markdown, ADR/decision parsing (title/status/date/supersedes), config/manifest parsing for procedures and dependencies, source-structure mapping to components. Every extraction returns evidence (path, line range, excerpt, classification, confidence).
PRD ref: `prd.md > Discovery and evidence`.

### Graph store (`server/src/db.ts`, `server/src/store.ts`)
SQLite schema for projects, source_files, evidence, nodes, edges, packs, review_runs, findings, maintenance flags, resolutions; stable UUIDs; a small data-access boundary so the store can swap to JSON without touching the rest; version field + tiny migration hook.
PRD ref: `prd.md > Knowledge graph`, `prd.md > States and Boundaries` (persistence).

### Approval service (`server/src/approvals.ts`)
Approve/edit/reject/uncertain/deprecate with attribution (local user, timestamp) and history records; enforces candidate-vs-approved separation; refresh never downgrades user-approved items.
PRD ref: `prd.md > Principles and decisions review`.

### Instruction pack generator (`server/src/pack.ts`)
Deterministic AGENTS.md-style markdown from approved nodes: purpose, principles, conventions, decisions + status, procedures, source pointers, uncertainty notes, freshness warnings; secret exclusion; overwrite detection + warning; generation metadata (timestamp, source fingerprint).
PRD ref: `prd.md > Instruction pack`.

### Diff + change checker (`server/src/diff.ts`, `server/src/checker.ts`)
Captures staged/unstaged/pasted diffs; parses hunks; redacts secret-looking values; matches rules to changes via governs edges, evidence paths, and user-encoded patterns; deterministic checks (path restrictions, prohibited patterns, required-test presence, status contradictions); produces findings with severity, certainty tier, both-side evidence, recommendation, blocking flag; stores review runs.
PRD ref: `prd.md > Change check`, `prd.md > Findings`.

### Watcher + maintenance detector (phase 2) (`server/src/watcher.ts`, `server/src/maintenance.ts`)
chokidar watch with debounce + manual refresh; incremental re-parse of affected files; marks affected evidence `possibly stale` (never rewrites approvals); conflict candidates (missing references, dated-status vs newer evidence, supersession chains, pointer lag) with side-by-side sources and user-only resolution.
PRD ref: `prd.md > Maintenance (built strictly after the core loop passes)`.

### API layer (`server/src/routes.ts`, `server/src/index.ts`)
REST endpoints for project open/validate/scan/reset, nodes/approvals, graph read, pack generate/export, diff/check/findings, maintenance refresh/resolve. Serves the built web UI in demo mode. Input validation at every boundary; repo content is always data, never executed.
PRD ref: all behavior headings.

### Web UI (`web/`)
Seven views (Project, Overview, Principles, Graph, Instruction Pack, Change Check, Maintenance), shared app shell with left nav, API client, cytoscape graph view with list/search/filters + detail panel, evidence rendering as escaped plain text with clickable paths/lines, honest empty/error/loading states everywhere.
PRD ref: `prd.md > Screens and Layout`.

## Data Model

SQLite (or fallback JSON) tables:

- **projects** — id, display_name, root_path, created_at, last_scan_at, settings JSON.
- **source_files** — id, project_id, relative_path, size, mtime, content_hash, parse_status, skip_reason.
- **evidence** — id, project_id, node_id (nullable), source_path, start_line, end_line, excerpt, classification (explicit-rule | documented-decision | observed-convention | inferred-candidate | status-claim | historical-note | open-question), observed_at, confidence.
- **nodes** — id, project_id, type (principle | decision | component | convention | procedure | dependency | verification | status-question), title, content, status (candidate | user-approved | source-claim | possibly-stale | possible-conflict | superseded | rejected | uncertain), origin (discovered | user), approved_by, approved_at, supersedes, created_at, updated_at.
- **edges** — id, project_id, source_node, target_node, relation (governs | implemented_by | depends_on | verified_by | supersedes | contradicts | related_to), status, evidence_id (nullable), origin (discovered | user).
- **packs** — id, project_id, generated_at, content, source_fingerprint, format.
- **review_runs** — id, project_id, created_at, diff_source (git-staged | git-unstaged | pasted), files_reviewed, checks_run JSON, summary.
- **findings** — id, review_run_id, rule_node_id, changed_path, changed_lines, kind, severity, certainty (deterministic | strong-evidence | possible-concern | needs-human-review), explanation, evidence JSON, recommendation, blocking, disposition (open | accepted | fixed | dismissed), resolution_note.
- **maintenance_flags** — id, project_id, kind (stale | conflict), node_id, evidence JSON (both sides + dates + reason), status (open | resolved | dismissed), resolution_note, created_at.
- **history** — id, project_id, entity_type, entity_id, action, actor, payload JSON, at.

Where data lives: one local DB file under the app's `data/` directory (never inside the target repo). Updates: every UI action hits the API, which writes through the store boundary. On restart: everything persists; the reset endpoint deletes the project's records, never the repo's files. App data location respects the "no writing into the target repository" rule; instruction-pack export is the only write into the repo and requires explicit user action + overwrite confirmation.

## File Structure

```
CarryForward/
├── package.json              # scripts: dev, build, start, demo, test, fixture
├── tsconfig.base.json
├── vite.config.ts            # web build (rooted at /web)
├── shared/
│   └── types.ts              # all cross-boundary TypeScript types
├── server/
│   ├── src/
│   │   ├── index.ts          # express bootstrap + static serving
│   │   ├── routes.ts         # API endpoints
│   │   ├── db.ts             # sqlite open/schema/migrations (+ JSON fallback switch)
│   │   ├── store.ts          # data access boundary
│   │   ├── scanner.ts        # safe bounded walk + exclusions
│   │   ├── extractor.ts      # deterministic parsing → candidates + evidence
│   │   ├── graph.ts          # nodes/edges construction
│   │   ├── approvals.ts      # review workflow + history
│   │   ├── pack.ts           # instruction pack generation
│   │   ├── diff.ts           # git diff capture + hunk parse + redaction
│   │   ├── checker.ts        # rule matching + deterministic checks + findings
│   │   ├── watcher.ts        # phase 2: file watching + refresh
│   │   ├── maintenance.ts   # phase 2: stale/conflict detection
│   │   └── secrets.ts        # secret-pattern detection/redaction
│   └── (co-located *.test.ts)
├── web/
│   └── src/
│       ├── main.tsx, App.tsx  # shell + nav
│       ├── views/             # Project, Overview, Principles, Graph, Pack, ChangeCheck, Maintenance
│       ├── components/        # evidence panel, node detail, finding card, states
│       ├── api.ts             # typed fetch client
│       └── styles.css         # design tokens + layout
├── scripts/
│   └── make-fixture.ts        # generates synthetic demo repo (fixtures/ is gitignored)
├── fixtures/                  # generated; never committed
├── data/                      # local app DB; gitignored
├── devpost/                   # skill-generated competition artifacts
├── docs/                      # VISION, ARCHITECTURE, MVP-PLAN, ROADMAP
├── doc-of-journey/             # daily/, decisions/, topics/
├── weeks/                      # README, memory-protocol, WEEK-00.., state/
├── AGENTS.md CLAUDE.md README.md PROJECT-CORE.md PROJECT_STATUS.md
├── SESSION-STATE.md NEXT-TASKS.md USER-THING-TO-DO.md
└── LICENSE                    # added at ship (learner's choice pending)
```

## External Services and Dependencies

None beyond npm packages. No APIs, no keys, no rate limits, no cost. The only external calls the app itself ever makes: none. `npm install` fetches the packages listed under Stack from the public npm registry.

## Important Failure Modes

- **better-sqlite3 native install fails** (Windows/Node 22) → store boundary swaps to an atomic-write JSON store; same features, honest notice in README. Checked first thing in the build.
- **Giant/locked repository** (OneDrive sync locks are a real possibility here) → scanner is bounded (file-count and size caps, visible skipped list); watcher is opt-in with manual refresh always available; errors surface honestly, never fake success.
- **Weird/encoding-damaged files** → per-file parse status recorded, scan continues; excerpts escaped and shown as text, never executed.

## What Was Simplified and Why

- **Single active project at a time** (records persist per project so you can reopen) instead of a project manager UI — P0 is explicitly one developer/one repo; a project list is surface area the demo doesn't need.
- **Deterministic heuristics only** for discovery — an AI classifier layer would add a provider, a key, and hallucination risk; the kernel (evidence-linked, user-approved knowledge) doesn't need it.
- **Plain-text rendering of repo excerpts** (escaped, monospace) instead of Markdown rendering — safer (repo content is untrusted) and faster; nothing is lost because the source file remains the authority.
- **cos-force layout via cytoscape built-ins** instead of a custom layout engine — good enough for a small graph, zero new dependencies.
- **Pasted-diff route kept minimal** (textarea + parse) — it serves the "proposed change" demo without file-import machinery.

## Decisions and Open Issues

- **Stack chosen by agent recommendation** (learner's verified environment + master prompt §7 guidance) and accepted under the learner's standing directive ("complete it in one go"). Tradeoffs accepted: SQLite native-module risk (JSON fallback ready); Express over Fastify (boring beats fast on a deadline); plain CSS over Tailwind (full control of the console aesthetic, zero PostCSS risk).
- **Learner uncertainty to clarify during build:** none was identified — the learner declined the technical interview ("get working"); noted honestly rather than invented. The one genuinely unfamiliar-and-risky piece on this machine is better-sqlite3's native binary — it gets verified in the first build step, before anything depends on it.
- **Carried from `prd.md > Open Questions`:** license choice (learner, at ship — blocks public push, not the build); demo video recording (learner records; ship phase prepares script and shot list).
- **OneDrive watch behavior** — chokidar on OneDrive-synced folders can produce duplicate/delayed events; accepted mitigation: debounced watcher is phase-2 convenience, manual refresh is the guaranteed path.
