# 0004 — Maintenance flags keyed by condition signature, resolution preserved

Date: 2026-10-27
Status: accepted

## Context

Master prompt §4.2: refresh flags stale/conflicting knowledge; never auto-rewrite; support dismiss/resolve with a recorded resolution. Re-flagging a dismissed condition after every refresh would make dismissal meaningless.

## Decision

Each flag carries a `signature` (hash of node + condition + file). Refresh upserts by signature: an existing flag updates its details but keeps its user status (open/resolved/dismissed). If the underlying condition changes (different hash/file), a new open flag appears. Stale detection compares the evidence's stored content hash against the latest scan; missing files flag as stale; supersession conflicts (newer ADR supersedes an older one whose source status still reads accepted) flag as conflict with both sides.

## Alternatives rejected

- Flag-by-flag re-creation each refresh: destroys user resolutions.
- Only flagging when the node is approved: candidate staleness also matters; all discovered user-touched nodes flag.

## Consequences

Dismissals persist while the same condition persists; approvals are never rewritten (tested); the fixture's ADR pair gives a deterministic conflict demo.
