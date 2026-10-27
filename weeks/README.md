# weeks/README.md

Session bootstrap and the week ladder for CarryForward development.

## Bootstrap order (every new session)

1. `AGENTS.md` → `PROJECT-CORE.md` (locked decisions — do not re-debate without a new decision record).
2. `PROJECT_STATUS.md` (capability truth — trust labels, not memory).
3. `SESSION-STATE.md` → `NEXT-TASKS.md` → `USER-THING-TO-DO.md` (if the next task is human-blocked, say so).
4. `weeks/WEEK-00.md` (rolling handoff: where work resumes).
5. `weeks/memory-protocol.md` (end-of-session procedure).
6. `weeks/state/current.json` → the exact session file its `latest` points to (validate it exists and parses).
7. `doc-of-journey/topics/in-progress.md`, and `doc-of-journey/topics/errors.md` before debugging anything.
8. Inspect actual `git status` and the file tree before editing — never assume the previous session's working state.

## Week ladder rules

- Exactly one `WEEK-XX` is in flight at a time; each has a scope, non-goals, and observable exit tests.
- A week is `DONE` only when its exit tests actually ran and passed and SESSION-STATE records the observed evidence.
- If state files conflict, preserve both pieces of evidence and log the conflict; do not pick a winner by timestamp alone.
- Scope changes update the affected `devpost/` artifact through the skill workflow plus this ladder, in one coordinated change.
