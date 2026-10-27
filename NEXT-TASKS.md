# NEXT-TASKS.md

Ordered task board, active week: WEEK-01 (build + ship). Updated 2026-10-27.

1. [x] Slices 1–8 of `devpost/checklist.md` — built, verified (72/72), committed.
2. [x] Discipline docs (AGENTS/CLAUDE/PROJECT-CORE/PROJECT_STATUS/SESSION-STATE/NEXT-TASKS/USER-THING-TO-DO, docs/, doc-of-journey/, weeks/) — written truthfully from observed build state.
3. [ ] LICENSE — blocked on learner's choice (MIT recommended). Add file + package.json license field, commit.
4. [ ] Final repo audit before publication: `git status` clean, tracked-file list reviewed, no secrets/private content, `.env`/`data/`/`fixtures/` confirmed ignored.
5. [ ] Public GitHub push — on learner's explicit go (gh authenticated as arcgod-design).
6. [ ] Demo video — learner records; script below in this file; agent prepared the shot list.
7. [ ] Devpost submission (learner-only): repo URL, description, video link, personal answers.
8. [ ] 5-build wrap-up: final review feedback + learning wrap-up + `devpost/app-map.html`.

## Demo video shot list (~2:40)

1. (0:00–0:20) Problem: rules scattered across repo files; agents miss them. Screen: CarryForward Project view.
2. (0:20–0:40) Open `fixtures/demo-repo`; scan; show exclusions notice.
3. (0:40–1:10) Principles: open the repository-layer candidate → evidence `PROJECT-CORE.md:7` → approve (edit adds `Forbidden pattern: \bquery\s*\( in src/services`).
4. (1:10–1:30) Graph: click the approved rule → walk to component/decision → evidence panel.
5. (1:30–1:50) Instruction Pack: generate → preview → copy; point at "candidates excluded" note.
6. (1:50–2:20) Change Check: unstaged diff → deterministic blocking finding, both evidence sides, certainty label; show scoped no-findings language isn't needed here (finding exists).
7. (2:20–2:35) Maintenance: refresh → conflict flag (ADR 0001 vs 0002) with both sides; resolve it.
8. (2:35–2:45) Honest close: "local MVP today; shared team workspaces are the roadmap."
