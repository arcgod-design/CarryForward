# weeks/memory-protocol.md

Required session-end procedure (anti-hallucination). Complete every step before stopping.

## Step 1 — Rolling handoff

Replace the `## Rolling handoff` section in `WEEK-00.md`:

```md
## Rolling handoff (update every session)

- **Date**: <YYYY-MM-DD>
- **In-flight week**: WEEK-XX — <one-line status>
- **Stack state**: <what runs now and exact commands>
- **Next concrete step**: <one specific next action>
- **Blockers**: <human-side items, referencing USER-THING-TO-DO.md entry numbers>
```

## Step 2 — Session snapshot

Write `weeks/state/sessions/YYYY-MM-DD.json` (suffix `-2`, `-3` for multiple same-day sessions). Valid UTF-8 JSON, no BOM:

```json
{
  "date": "YYYY-MM-DD",
  "in_flight_week": "WEEK-XX",
  "week_status": "in-progress | done",
  "verified": ["exact command actually run — observed result"],
  "files_touched": ["relative/path/to/file"],
  "decisions_locked": ["ADR number — one-line decision, if any"],
  "next_step": "one concrete next action",
  "user_blockers": ["USER-THING-TO-DO.md entry numbers awaiting the user"]
}
```

Only actions actually executed and results actually observed belong under `verified`. Never write vague claims like "tests pass" without naming the command and result.

## Step 3 — Pointer

Update `weeks/state/current.json` to `{ "latest": "sessions/YYYY-MM-DD.json" }`; validate the JSON parses and the target exists.

## Step 4 — Human-readable records

Update whatever this session changed: `SESSION-STATE.md` (as-of date, verified state, pain points, blockers, one next step), `doc-of-journey/daily/` note for this session, `topics/in-progress.md` if focus changed, `topics/errors.md` for any new >5-minute error (after checking for duplicates), `PROJECT_STATUS.md` if capability state changed, `NEXT-TASKS.md`, the in-flight `WEEK-XX.md`, decisions only when actually locked.

## Step 5 — Verify before stopping

JSON parse checks for the new snapshot and pointer; run the relevant test suite; read the diff; confirm no secret, private path, or credential was recorded anywhere; confirm the next step is actionable by a fresh session with no chat memory.

## Step 6 — Git (when authorized)

Small, attributable commits with conventional messages. Never commit secrets, never force-push, never amend published history, never claim a push that did not happen. Local commits during the build were authorized; any public push requires the learner's explicit go.
