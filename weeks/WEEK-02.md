# WEEK-02.md — Graph experience upgrades and ship

Status: **in-progress** (implementation exit tests passed 2026-10-27 session 2; remaining items are learner-blocked: demo confirmation, video, submission).

## Purpose

Answer the learner's real-repo feedback: make the graph readable at scale, show the whole code memory with folder drill-down, and adopt the archify-logical features (standalone HTML artifact + commit-pinned evidence) — without violating the greenfield rules or the small-knowledge-graph kernel.

## In scope

Raised caps (ADR 0006), component-noise exclusion, curated default canvas, zoom/hover labels, legend, expandable folder file-leaves, standalone graph.html report, commit pinning, pack "Repository knowledge structure" section, learner re-check, video, submission.

## Non-goals

tree-sitter AST symbol graphs (ADR 0005 ROADMAP); copying archify code; uncapped rendering.

## Exit tests (implementation ones observed)

1. `npx vitest run` → **79 passed (79)** across 11 files — 2026-10-27.
2. `npm run build` → clean — 2026-10-27.
3. Live on learner's aws repo: refresh surfaced **100 previously truncated files**; default canvas **330 → 8 nodes**; components 13 → 5 (junk excluded); commit pinned `a5ea5a15…`; graph.html generated (3.2 MB) with payload + pin + project name verified via UTF-8 read.

## Remaining exit tests (learner)

- Learner hard-refreshes the UI, expands a folder node, downloads graph.html, and confirms the graph experience passes.
- Video recorded and public; Devpost submission completed.
