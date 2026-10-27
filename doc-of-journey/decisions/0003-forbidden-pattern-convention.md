# 0003 — User-encoded forbidden patterns as the deterministic check convention

Date: 2026-10-26
Status: accepted

## Context

P0.6 requires deterministic checks ("prohibited patterns explicitly encoded by the user") but the master prompt forbids hard-coded demo findings. A general, explainable mechanism was needed that any repository could use.

## Decision

Approved rules may carry a line `Forbidden pattern: <regex> in <path-prefix>`. The checker extracts these only from **user-approved** rules, applies them to added/removed diff lines scoped by path prefix, and labels hits `deterministic`, severity high, blocking. Invalid regexes are skipped, not guessed. Prose-only rules appear as applicable-rule context, never as mechanical findings.

## Alternatives rejected

- Inferring prohibited patterns from prose (magical, unexplainable, false-positive factory).
- A separate rules DSL/UI: scope cost; the convention rides the existing edit-approve flow and lands in the pack naturally.

## Consequences

The demo fixture and any real repo use the identical pipeline (no special-casing); the convention is documented in README and visible in the pack output.
