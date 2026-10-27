# ROADMAP.md

Staged delivery. Phase 1 is this hackathon build — verified and shipped; everything below it is planned design, not working software.

## Phase 1 — Individual foundation (BUILT, verified 2026-10-27)

Local repository discovery with evidence; user approval workflow with attribution/history; navigable typed knowledge graph with list/canvas/filter/focus; deterministic instruction pack with safe export; git-diff change check with user-encoded pattern rules, missing-test and status-evidence checks, honest certainty tiers; refresh + stale/conflict detection with human-only resolution; opt-in best-effort watcher; `graph.json` export; synthetic resettable demo fixture. Status: `WORKING` in PROJECT_STATUS.md.

## Phase 2 — Reliable agent consumption

- Stable CLI/API retrieval endpoint: request a topic or changed files → applicable approved rules, relevant decisions, source evidence, uncertainty — the same interface the pack generator and checker use internally.
- Agent-pack versioning: fingerprint-tagged pack history already persisted (`packs` table); surface diffs between generations.
- Retrieval tied to project/version/rules so agents can cite exactly what guided them.

## Phase 3 — Team workspace

- Accounts, membership, roles, permissions (read / suggest / approve / admin) enforced by the service, never by prompts.
- Shared, versioned principles and decisions with review queues and approval history; conflict-safe updates (no silent overwrites between members).
- Audit trail already being recorded per entity (`history` table with actor fields) extended to team identities.

## Phase 4 — Cloud collaboration and agent coordination

- Secure opt-in sync of project knowledge (explicit disclosure of what is transmitted; repo source stays local unless chosen).
- Multiple developers and agents against one knowledge base: task/change handoffs, scoped agent permissions, review queues, provider/agent adapters.
- Design boundaries prepared in Phase 1 for this: provenance separation, stable IDs, approval metadata, store boundary, evidence-first graph.

## Explicitly not on this roadmap

ZIP/historical-session import; automatic invention of decisions or lessons; a custom graph database or vector/RAG stack without demonstrated need; silent edits or auto-commit/push — permanently.
