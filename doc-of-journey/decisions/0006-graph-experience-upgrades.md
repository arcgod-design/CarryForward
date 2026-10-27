# 0006 — Graph experience: raised caps, file drill-down, standalone HTML report, commit pinning

Date: 2026-10-27
Status: accepted

## Context

Post-demo learner feedback on a real 330-node repository: the canvas rendered dependencies and junk components into an unreadable grid; folder nodes stopped at the folder with no inner files; caps felt arbitrary. Learner referenced Graphify and Archify (both fetched and analyzed; both cap visualization themselves — Graphify aggregates above 5,000 nodes) and authorized copying Archify's code.

## Decision

1. **Caps raised, floors kept.** Scanner: 20,000 listed files, depth 16, 8,000 dirs (was 5,000/12/4,000). Extractor: 1,500 items, 400 rules, 50 open questions (was 400/120/20). Components: top 50. Rationale: Graphify itself caps at 5,000 rendered nodes with aggregation above; uncapped graphs are unreadable and crash browsers. Pathological-repo protection stays.
2. **File drill-down as canvas overlay, not knowledge nodes.** Double-clicking a component node (or the panel button) expands its recorded files as rectangle leaf nodes; clicking a file lists the knowledge extracted from it. Files are a UI rendering of stored `source_files` records — not fabricated graph nodes — preserving the master prompt's "no knowledge node per file" rule. Junk components (dot-dirs, generated dirs) were already excluded in the prior revision.
3. **Standalone graph.html report** (inspired by Archify's self-contained HTML artifact pattern; **built natively, nothing copied** — competition greenfield rule + license hygiene). One endpoint (`GET /projects/:id/graph/report`) emits a single self-contained HTML: cytoscape inlined, embedded JSON payload (`<` escaped), zoom-gated labels, legend, evidence panel, file→knowledge drill-through. ~3 MB per report.
4. **Commit pinning** (Archify's `SRC` evidence discipline): every scan/refresh records `git rev-parse HEAD` on the project; the pack and the report state which commit the evidence was captured at.
5. **Instruction pack gains a "Repository knowledge structure" section**: discovered instruction/core/status/decision/topic files grouped by role with guidance, so agents reading the pack know where the project's memory lives.

## Alternatives rejected

- Copying Archify's renderer: violates the greenfield competition rule, adds foreign vendored code and license overhead; the needed pattern is ~150 lines.
- tree-sitter AST symbol graphs (Graphify-style whole-code graphs): thousands of commits of work; stays ROADMAP per ADR 0005.
- Uncapped rendering: unreadable and unsafe; both reference products cap.

## Consequences

The learner's real 330-node repo now renders 8 connected knowledge nodes by default with drill-down to any file; the refresh surfaced 100 previously truncated files under the new caps. Tests 79/79; the report and pin verified live.
