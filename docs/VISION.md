# VISION.md

## Destination

CarryForward becomes a **shared project-maintenance workspace for an entire engineering team and its coding agents**. One project knowledge base: the same approved principles, decisions, architecture, current status, and change findings for every developer and every agent, with clear ownership of approvals and a full audit trail — which rule was used, what evidence supports it, who approved it, which change was checked, what remains unresolved.

## Why this is the destination, not a footnote

The individual-first MVP exists because the foundational workflow must be provable: a human reviews machine-discovered knowledge, approves it with attribution, and that approved knowledge changes what agents and reviews see. Every team feature sits on exactly that loop. If it works for one developer, the team product extends the same records with accounts, permissions, and sync — it does not replace them.

## The path (staged — see ROADMAP.md)

1. Individual foundation (this build): local discovery, approvals, evidence-linked graph, instruction pack, change check, refresh, stale/conflict detection.
2. Reliable agent consumption: stable retrieval endpoint tied to project/version/rules, beyond the current graph.json export.
3. Team workspace: accounts, membership, permissions, shared versioned decisions, review/approval history, conflict-safe updates.
4. Cloud collaboration and agent coordination: secure opt-in sync, agent handoffs with scoped permissions, review queues, audit trail, provider/agent adapters.

## Non-negotiables carried into every phase

- Evidence and provenance are first-class; no silent knowledge, no decorative links.
- User approval is a human act; AI output is advisory and can never approve.
- Security boundaries live below the model: repo content stays untrusted data; secrets never travel; permissions are enforced by the service, not by prompts.
- Local-first default; any transmission is explicit opt-in with disclosed content and destination.

## Explicitly not the product

ZIP/historical-session import, auto-invented decisions, silent source edits, a chatbot that summarizes a repo once and calls it knowledge. CarryForward maintains a living, reviewed, operational project memory — that is the whole idea.
