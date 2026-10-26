---
doc: prd
status: approved
---
# CarryForward — Product Requirements

One line: a local-first desktop-style web app that helps a solo developer turn their repository's scattered rules and decisions into an evidence-backed knowledge graph, generate agent instructions from it, and check code changes against it.

Source: develops `scope.md > The Unique Kernel`, `The Core Loop`, `What "Working" Looks Like`, `The POC Boundary`. Full requirements authority: the learner's master prompt (locked interpretation).

## The Core Journey

1. The developer opens CarryForward and sees the **Project** screen. They type or pick a local repository path and open it.
2. CarryForward validates the path (exists, readable, looks like a repo/workspace) and shows the project name, path, and a clear "local-only" privacy notice: nothing leaves the machine.
3. They run a **scan**. CarryForward walks the repository inside the selected root only, skipping generated/vendor/secret paths, and lists what it found and what it skipped, with the reason for each skip.
4. The **Overview** screen shows real counts: discovered source files, candidate principles, approved rules, decisions, components, open questions, last scan time — each count tied to stored records, no decorative metrics.
5. On **Principles**, they review discovered candidates one by one: each shows its statement, its source evidence (file path, line range, excerpt), and its classification (explicit rule, decision, convention, inferred candidate, status claim, historical note). They approve one, edit-and-approve another, reject one, and mark one uncertain. Approved items are visually distinct from machine candidates.
6. On the **Graph**, they click an approved principle and see its connected nodes — the decision it implements, the component it governs, its source evidence — and can navigate node to node. A list/search view with filters (type, status) exists alongside the canvas; selecting in either view opens the same detail panel with source paths/lines and status.
7. On **Instruction Pack**, they preview the generated agent instruction file (project purpose, approved principles, conventions, decisions + status, procedures, safe-workflow rules, source pointers, uncertainty notes) and export it. If the target repo already has an `AGENTS.md`, CarryForward warns before any overwrite and offers a non-destructive alternative. Copy to clipboard and download both work.
8. On **Change Check**, they inspect the repository's current git diff (staged and/or unstaged). CarryForward lists changed files and hunks, matches them against applicable approved rules, runs its deterministic checks, and shows **findings**: what was found, severity, the applicable rule (approved vs inferred), evidence on both sides (changed lines + rule source lines), a certainty label (`deterministic` / `strong evidence` / `possible concern` / `needs human review`), and a recommended action. If a diff contains a secret-looking value, the value is redacted with a visible warning.
9. A scoped result banner states exactly what was checked — "no issues found by the checks that ran" — never "compliant, guaranteed."
10. When they close and reopen the app, everything is still there: project, approvals, graph, findings.

The loop that proves the product: open → discover → approve → graph → export pack → check diff → evidence-backed finding.

## Screens and Layout

One window, seven views as a left-nav app shell — a compact developer console, not seven disconnected pages:

1. **Project** — path entry/pick, open/validate, project identity, scan state, privacy notice, reset/remove index.
2. **Overview** — counts from real records, last scan, quick actions to continue.
3. **Principles** — candidate review queue + approved list; per-item evidence panel.
4. **Graph** — canvas + list/search + filters (type/status); detail panel with source links, confidence/status.
5. **Instruction Pack** — preview, copy/download/export, generation metadata (when generated, from what source state), overwrite warning.
6. **Change Check** — diff view (changed files/hunks), applicable rules, checks run, findings list with evidence and recommendations.
7. **Maintenance** — watch/refresh state, stale/conflict findings, resolve/dismiss actions with notes.

## Look and Feel

A serious developer tool (master prompt §9): grounded in file paths and line numbers, calm and deliberate, readable typography with strong hierarchy, generous spacing, keyboard-accessible controls, sufficient contrast. Distinct visual treatment for the four knowledge classes: approved rules, discovered candidates, inferred concerns, verified failures. No generic chatbot landing styling, no gratuitous gradients/animations, no giant dashboard of fake metrics. Dark, tool-like console aesthetic; monospace for paths/code evidence.

## Features and Behavior

### Opening a repository
- User enters/selects a local folder; app validates existence/readability and shows project identity.
- Scan stays inside the chosen root; never reads outside it; never treats `.git` internals as documentation.
- Default exclusions (`.git`, `node_modules`, `dist`, `build`, caches, `.env*`, keys/credentials, common secret files) are listed visibly with reasons; exclusions are explainable, not hidden.
- Graceful handling: inaccessible folders, invalid paths, huge repos (bounded scan), missing git metadata, empty repos — each shows an honest state, never a crash or fake success.
- **Acceptance:** opening a fixture repo shows name/path/scan state; opening an invalid path shows a clear error; the scanner provably never touches excluded paths (test).

### Discovery and evidence
- Recognizes common instruction/source-of-truth files (AGENTS.md, CLAUDE.md, copilot-instructions, README, CONTRIBUTING, PROJECT-CORE/STATUS/SESSION-STATE-type docs, docs/ folder, numbered decision records, topic/status/work-history conventions, package manifests, test/lint configs) **as examples** — it respects whatever names the target repo actually uses.
- Every extracted statement keeps evidence: relative path, line range/symbol, short excerpt, classification, timestamp, confidence/verification state.
- Code demonstrates what exists; it never auto-promotes a code pattern to an approved principle.
- Deterministic parsers/heuristics only; the app works with zero AI keys and says so plainly.
- **Acceptance:** a candidate principle displays its exact source path, lines, and excerpt; parse failures show status instead of crashing (tests).

### Principles and decisions review
- Add, edit, approve, reject, mark uncertain/deprecated; user-approved items distinct from discovered candidates at all times (data model + UI).
- Decisions keep their stated status (proposed/accepted/superseded/…); never guessed silently.
- Source and rationale visible before approval; principles can link to components, decisions, tests.
- Changing an approved principle is attributable to the local user and reviewable (history), with a data shape that can later carry team authorship.
- The app never edits the target repo's source documents.
- **Acceptance:** approve/edit/reject flows persist across restart; reload does not downgrade or rewrite user approvals (tests).

### Knowledge graph
- Small typed graph (node types: principle/rule, decision, component, convention, procedure, dependency, verification, status/open question; relations: governs, implemented_by, depends_on, verified_by, supersedes, contradicts, related_to) — plain descriptive labels, no invented nodes for every file.
- Navigable: select node → details + linked nodes + source evidence; move between nodes. List/table/search view with type/status filters exists; graph canvas never the only route.
- Edges come from evidence or explicit user curation only — no decorative links.
- If discovered data is large, filtering/focus on a node's neighborhood instead of rendering everything.
- **Acceptance:** from an approved principle a user can walk to a decision and to source evidence and back; no dangling edges (test).

### Instruction pack
- Deterministic generation from approved graph + source data: purpose, approved principles, architecture boundaries, conventions, decisions + status, safe workflow rules, source-of-truth pointers, how agents should consult context; includes evidence pointers and uncertainty notes; excludes secrets.
- Preview, copy, download; generation timestamp + source fingerprint shown.
- Respects the repo's existing agent files: proposes merge/update or separate file; **never silently overwrites**; warning before overwrite.
- Historical/status notes are freshness-checked before becoming instructions.
- **Acceptance:** exported pack contains approved rules with source pointers, contains no secret content, and does not overwrite an existing instruction file without explicit confirmation (tests).

### Change check
- Reads the opened repo's real git diff (staged and/or unstaged); paste-a-diff is optional if it fits.
- Identifies changed files/hunks; finds applicable rules by component/path/language/convention links.
- Deterministic checks where practical: path restrictions, required test/config presence, user-encoded prohibited patterns, status contradictions. Explainable, small.
- Never runs arbitrary repo code; any command execution requires showing the exact command and explicit user approval; repo content can never override app policy.
- Never auto-commits/pushes/modifies the user's code.
- **Acceptance:** a diff that adds a direct database call in a service layer, against an approved "repository-layer access only" principle, produces a finding citing the rule, the changed hunk, and an honest certainty label (controlled test).

### Findings
- Each finding states: what was found (plain language), severity + why it matters, applicable rule + approved-vs-inferred status, evidence on both sides, certainty label with what is uncertain, recommended action, blocking/advisory/informational flag.
- Four evidence tiers kept distinct: deterministic failure / likely violation / possible conflict / unknown (evidence unavailable).
- "No findings" is always scoped: only the checks that ran found nothing — never a compliance guarantee.
- **Acceptance:** findings in tests carry all required fields; a deterministic check failure is visually and semantically distinct from an advisory concern (tests).

### Maintenance (built strictly after the core loop passes)
- Watch tracked files (or reliable manual refresh); detect add/change/rename/delete; re-parse only affected files; update dependent records/evidence.
- User-approved principles are never downgraded or rewritten by watcher events; supporting evidence changes mark items for review.
- Debounced events; honest watcher errors; manual refresh always available; last-scan display with changed files and parse failures.
- Stale/conflict detection: rules pointing to missing files/symbols, status records older than newer source evidence, superseded decisions, pointer-vs-dated-record gaps. Every candidate shows **both** sides with dates and why they seem inconsistent; explicit states (`possibly stale`, `possible conflict`, `resolved`, `needs user review`); never auto-deletes or silently rewrites; dismiss/resolve with recorded note.
- Distinguishes normal historical progression from true conflict (an old session note is not false merely because a newer status exists).
- **Acceptance:** editing/deleting a tracked file marks affected evidence stale without touching approvals; a planted conflicting-decision fixture shows both sources side-by-side and requires the user to resolve (tests).

## States and Boundaries

- **First use / no project** — clear "open a repository to begin" state with the privacy notice.
- **Empty repo** — honest empty result: nothing discovered, guidance on what CarryForward looks for; no fabricated nodes.
- **Invalid/inaccessible path** — specific error (not found / not readable / not a directory), recovery suggestion.
- **Unreadable/invalid file during scan** — file marked with parse error; scan continues.
- **Huge repo** — bounded scan (file count/size caps) with visible notice of what was skipped.
- **No git / no diff** — change check explains there is nothing to inspect or git is absent; paste-diff route remains.
- **Secrets encountered** — redacted in every view, export, and log, with a visible warning.
- **No findings** — scoped banner naming the checks that ran.
- **Persistence** — project, source records, evidence, approvals, graph edits, findings, resolutions survive restart; a reset path removes the app's index without touching the repo's files.
- **Trust boundary** — repo content is data, never instructions to the app; no auto-execution of repo scripts; no auto-upload; local files only.

## Product Decisions

- Individual-first MVP, team/cloud as documented long-term destination — the learner's locked interpretation (scope > kernel).
- Deterministic-only core: works with zero AI keys; no AI is required for any P0 behavior — competition rules + master prompt (§1.2, §8).
- Local-first: repository contents and knowledge stay on the machine; no automatic upload — master prompt §8.
- Never silently overwrite the target repo; never auto-commit/push/PR — master prompt §0 rule 8, §8.
- Exclusions visible and explainable by default — master prompt §3 P0.1.
- Approvals structurally distinct from candidates in the data model, not just the UI — master prompt §3 P0.3.
- Plain names, no invented branded subsystem labels — master prompt §0 rule 10.
- License: chosen by the learner at ship time (deferred; tracked as a user-blocker).
- Maintenance features (watcher, stale/conflict) built only after the core loop passes acceptance — master prompt §4 gate.

## What We're Building

Everything above under **Features and Behavior** through **Findings**, plus the seven screens, persistence, and the synthetic demo fixture with a reset path. The finish line is the master prompt's P0 acceptance list, verifiable on screen in about a minute: open fixture repo → discover with evidence → approve a principle → navigate graph to evidence → export instruction pack → check the violating diff → see an evidence-backed finding with honest uncertainty.

## Deferred From the POC

- **Maintenance layer (watcher + stale/conflict detection)** — in this build's plan, but sequenced strictly after the P0 gate passes (master prompt §4); if time runs out it ships as honestly-labeled ROADMAP, never as a claim.
- **Team workspaces, accounts, permissions, cloud sync, agent-orchestration endpoints** — the main long-term vision; designed-for in the data model (stable IDs, provenance, approval metadata, storage boundary) but not built — master prompt §5.
- **AI-assisted advisory layer** — no provider integration now; deterministic pipeline must stand alone; boundary documented.

## Possible Later Enhancements

- A stable CLI/API endpoint for agents to retrieve applicable rules for a task (retrieval tied to project/version).
- Team review queues, shared approvals, conflict-safe sync.
- AI-assisted classification as an optional, clearly-labeled advisory layer with explicit provider consent.

## Non-Goals

- ZIP/historical-session-note import — the reference archive was context, not a feature (scope > Explicitly Cut).
- Editing the target repository's files (other than user-confirmed instruction-pack export), auto-repair, auto-commit/push/PR.
- Custom graph database, vector DB/RAG stack, orchestration framework — a small typed graph suffices.
- Fake metrics, decorative graph edges, hard-coded demo findings, "AI says" evidence.
- Cloud infrastructure of any kind in this build.

## Open Questions

- **License choice** — learner decision, must land before the public push; does not block spec/build. Tracked in USER-THING-TO-DO.md.
- **Demo video recording** — learner records; script + shot list prepared in ship phase; does not block build.
