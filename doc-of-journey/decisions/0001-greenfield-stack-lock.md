# 0001 — Greenfield stack lock

Date: 2026-10-26
Status: accepted

## Context

Hackathon build under a hard clock; environment verified: Node 22, npm 10, git 2.54, gh authenticated. Master prompt §7 prefers TypeScript strict, one compact local persistence layer, smallest stack that supports the loop.

## Decision

Node 22 + TypeScript strict; Express 4; better-sqlite3 (verified native binary loads before anything depended on it); Vite + React 18 + plain-CSS design tokens (no CSS framework); cytoscape for graph; chokidar for watching; parse-diff for diffs; vitest for tests; git via `execFile` only. No cloud, no accounts, no AI SDKs.

## Alternatives rejected

- Electron/Tauri desktop shell: setup cost with no kernel benefit — the local web app pattern is an approved P0.1 design.
- Tailwind: zero-PostCSS-risk plain CSS keeps full control of the console aesthetic.
- Fastify: Express is boring and known; boring wins on a deadline.

## Consequences

One command installs and runs everything; the one native dependency (better-sqlite3) was proven first and carries a documented JSON-store fallback design behind the store boundary.
