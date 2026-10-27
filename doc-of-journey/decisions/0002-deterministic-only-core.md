# 0002 — Deterministic-only core, zero AI keys

Date: 2026-10-26
Status: accepted

## Context

Master prompt §3 P0.2 and competition constraints: the app must work without any AI provider; the learner's OpenCode NIM key is for the build agent, never for the product.

## Decision

Discovery, checks, and pack generation are deterministic parsers/heuristics. No LLM anywhere in the product. Advisory AI layers are documented ROADMAP only, behind explicit provider consent.

## Alternatives rejected

Optional BYOK classifier at P0: adds provider, key, and hallucination risk to the kernel for no acceptance-criteria gain.

## Consequences

Everything is explainable and testable (72 tests, no mocks of AI behavior); honesty labels (`deterministic` vs advisory) are structural rather than aspirational.
