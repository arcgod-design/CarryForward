# AGENTS.md

CarryForward is a local-first project maintainer built for the Devpost Build With AI: Basics hackathon.

## Boot rules for any coding agent working in this repository

1. Read this file, then `PROJECT-CORE.md` (approved principles and locked decisions — never silently override them).
2. Read `PROJECT_STATUS.md` for what is actually verified. Capability labels: `WORKING`, `PROTO`, `ROADMAP`. Every `WORKING` claim names the command and the observed result. Do not claim anything is working without running it.
3. Read `SESSION-STATE.md` for current state and the one next step, and `NEXT-TASKS.md` for the ordered task board.
4. Check `USER-THING-TO-DO.md` — if the next task is blocked on the human, say so; do not relabel human work as agent work.
5. Architectural decisions get a new numbered record in `doc-of-journey/decisions/` the day they are made. Never rewrite an accepted decision; supersede it.
6. Errors costing more than five minutes go into `doc-of-journey/topics/errors.md` — search it before debugging.
7. The application never edits a user's target repository without an explicit, confirmed export action. Never add auto-commit, auto-push, or silent file writes.
8. This app runs with zero AI keys. Never introduce a model/API dependency into core functionality; advisory AI layers are ROADMAP only.
9. The Devpost Learn Skill Pack artifacts in `devpost/` are the competition's required documents; update them through their skill workflow, not by hand.
10. Full session bootstrap/end-of-session procedures: `weeks/README.md` and `weeks/memory-protocol.md`.
