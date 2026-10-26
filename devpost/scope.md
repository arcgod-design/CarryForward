---
doc: scope
status: approved
---
# CarryForward

One line: a local, individual-first project maintainer that turns a repository's scattered rules and decisions into an evidence-backed knowledge graph, guides AI coding agents with it, and checks proposed changes against it.

## The Unique Kernel
Every principle, decision, and finding stays **attached to its source evidence** (file, line range, excerpt, approval status) and is **consumed operationally** — the same graph that a human browses generates the agent instruction pack and powers the diff checks. Delete that and this is just another "read your repo and summarize it" chatbot, which is exactly what we're not building.

## Who It's For
A solo developer who works with AI coding agents (OpenCode, Claude Code, Copilot) in local repositories. Today their project's rules live scattered across `AGENTS.md`, `CLAUDE.md`, decision records, and status docs — and agents miss them, follow stale guidance, or repeat past mistakes. That developer is you, this month, on this project.

## The Core Loop
Open a local repo → CarryForward discovers instruction/decision/convention files with source evidence → you review and approve principles → browse the small navigable graph (rule ↔ decision ↔ component ↔ evidence) → export a project-specific agent instruction pack → run a change check on a real git diff → get findings that cite the exact rule and the exact changed lines, with honest uncertainty labels.

## Inspiration & Identity
A serious developer tool, not a chatbot landing page: dense, grounded in file paths and line numbers, calm UI, counts tied to real stored records only. The user's own `doc-of-journey/` working discipline is the inspiration — the product exists because that discipline shouldn't require hand-maintaining a dozen state files.

## Why This Matters to the Learner
The user runs this exact workflow by hand today (CLAUDE.md boot maps, weeks/ state, ADRs). It's the personal pain the master prompt was written to end: "coding agents can miss rules, apply stale guidance, conflict with existing decisions, or repeat errors because the reasons are scattered."

## What "Working" Looks Like
Demo on a small synthetic repo: open it, see discovered files with evidence; approve a candidate principle (e.g. "all database access goes through the repository layer"); click through the graph to its decision and source lines; export an instruction pack that respects an existing AGENTS.md; then check a diff that adds a direct SQL query in a service — CarryForward flags it citing the approved principle, the changed hunk, and labels the certainty honestly. The "oh, that's cool" beat: the finding links both directions — changed code → rule → its source evidence — and says what it does NOT know.

## The POC Boundary
In: open repo (validated path), safe scan with visible exclusions, deterministic discovery of common doc types with evidence (path/lines/excerpt), user approval flow (approve/edit/reject/uncertain, persisted), small typed graph with list+detail+filters (navigable, evidence-linked), instruction pack preview/export (never silently overwrites existing files), git diff change check with rule matching, findings with severity/uncertainty/recommendation, local persistence (SQLite), deterministic-only operation (works with zero AI keys).

Later (only after the core loop passes its acceptance gate): file watching + affected-record refresh, stale/conflict detection with side-by-side evidence.

## Later
- File watching + incremental refresh, stale/conflicting-rule detection (built after P0 passes, per master prompt Section 4).
- Team workspaces, cloud sync, accounts/permissions, agent orchestration endpoints — the main long-term vision, documented in docs/VISION.md + ROADMAP, never claimed as shipped.

## Explicitly Cut
- ZIP / historical-session-note import — the reference archive was input for understanding, not a product requirement.
- Cloud backend, accounts, real-time collaboration — no infrastructure for appearance; the local loop must prove itself first.
- Custom graph database, vector DB/RAG, orchestration framework — a small typed graph in SQLite is sufficient and explainable.
- AI-provider-dependent features as core functionality — deterministic parsing/checks must work with zero keys; AI layers are advisory only.
- Auto-commit/push/PR, silent edits of the target repo, auto-"repair" — the product checks and guides; it never takes over.
- Demo-appearing hard-coded findings — fixtures prove the real pipeline or they don't ship as claims.
