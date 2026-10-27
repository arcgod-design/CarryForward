# 0005 — graph.json export adopted; AST-level code graphs stay ROADMAP

Date: 2026-10-27
Status: accepted

## Context

Learner pointed at Graphify (136k stars) and CodeGraph (75k stars) as references mid-build. Both are code-structure knowledge graphs with agent-consumption stories; both took thousands of commits.

## Decision

Adopted the graph-as-data pattern: a `GET /api/projects/:id/graph/export` endpoint returning schema-versioned `{nodes, edges, evidence}` — the cheapest deterministic agent-consumable artifact, consistent with the spec's agent-interface direction. Everything else those projects offer (tree-sitter AST parsing across ~40 languages, Leiden communities, MCP servers, native watchers, Rust kernels) is recorded as ROADMAP.

## Alternatives rejected

- Importing/vendoring either project: master prompt forbids transplanting complete third-party apps into the greenfield submission; the kernel (approved principles checked against diffs) is deliberately different from code-structure indexing.
- Adding AST parsing at P0: violates the PoC boundary and the small-graph rule.

## Consequences

Agents and judges get a machine-readable graph today (~40 lines of code); the product stays distinct from both references rather than a weaker copy of them.
