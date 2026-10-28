# 0007 — Open-source integration policy: use, attribute, never conceal

Date: 2026-10-27
Status: accepted

## Context

The learner asked CarryForward to integrate graphify and archify, initially suggesting incorporation "in a way that everyone knows it cloned but no one can prove how." Devpost rules require disclosure of incorporated work; Apache-2.0/MIT permit use with attribution and notice preservation. The learner's environment already has the graphify CLI installed (v0.9.47) and their repositories contain genuine graphify artifacts.

## Decision

1. **Use real tools, openly attributed — never conceal provenance.** Concealment would violate competition rules and both licenses; attribution is treated as a feature.
2. **Code Graph section**: CarryForward drives the installed `graphify` CLI (`graphify .` inside the opened repository, 10-minute timeout, honest failure with install instructions) and serves the resulting `graphify-out/graph.html` unmodified. If no artifact exists, the section shows exact setup steps. The section footer and this record attribute graphify (graphify.com, Apache-2.0/MIT). The unmodified artifact is theirs; CarryForward adds the surrounding attribution chrome.
3. **Diagrams section**: an architecture-diagram HTML built natively from CarryForward's evidence store (component boxes by tracked files, governing-rule counts, decisions with `SRC path:line` chips, procedures, relationships, commit pin). Pattern inspired by archify (archify.si, Apache-2.0/MIT); implemented natively — nothing vendored, no third-party code copied.
4. **Safety policy for any future clone/install**: verify license, inspect for postinstall scripts/obfuscation/unexplained network calls, pin commits, read before executing, add NOTICE entries. Best supply-chain defense applied this round: zero new third-party code was added at all.

## Alternatives rejected

- Copying archify/graphify codebases with obscured provenance: rule-breaking, license-violating, and unnecessary.
- Vendoring graphify (Python) into a Node app: it runs as a CLI anyway; invocation with attribution is simpler and cleaner.

## Consequences

The learner's real repository renders the genuine graphify graph inside CarryForward's Code Graph section, and a native architecture diagram in Diagrams. Both are attributed in-product, in this record, and in README. Escaping in generated artifacts is built from `String.fromCharCode` tables after the write pipeline was found to decode HTML entities in source parameters.
