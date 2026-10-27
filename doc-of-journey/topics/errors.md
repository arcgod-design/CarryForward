# topics/errors.md

Append-only. Errors that cost more than five minutes. Search before debugging.

- **npm ETARGET on parse-diff@^5.0.0 (2026-10-26):** I guessed a major version that doesn't exist; latest is 0.12.0. Fix: check `npm view parse-diff versions` before pinning unfamiliar packages.
- **Test fixture ENOENT (three times, 2026-10-26/27):** wrote files into nested directories (`src/repositories/…`, `src/services/…`) without `mkdirSync`-ing the full path. Fix: always `mkdirSync(dirname, {recursive:true})` in fixtures; tests caught it each time before it could hide.
- **Windows path separators in scanner tests (2026-10-26):** `path.join` produced `src\a.ts`; tests expected forward slashes. Fix: normalize all stored relative paths to `/` at the scanner boundary (portable, git-consistent). Second-order bug: depth check still split on `path.sep` — split on `/`.
- **Express 4 async crash (2026-10-27):** the check route wrapped only the git capture in try/catch; a later throw became an unhandled rejection and Node 22 killed the process mid-request. Root cause underneath: `runChecks` generated its own run id, and the route generated a different one — findings referenced a review_run row that never existed → FK violation on save. Fix (both): wrap the entire handler; `saveReviewRun` stamps `run.id` onto every finding at the boundary. Lesson: catch async route failures at the route boundary; keep generated-key consistency in one place.
- **Pack determinism test failure (2026-10-27):** pack content embedded a generation timestamp, so "same graph state → identical content" was false. Fix: timestamp is pack metadata, not content.
- **Watcher state type errors (2026-10-27):** object literals `{ lastEvent: null, … }` inferred `null` types; assignments of strings failed tsc. Fix: explicit `WatchState` interface on the state map and the literal.
- **tsc emits despite errors (2026-10-27):** a type error in routes.ts still emitted dist, so a live check ran stale-looking code while "succeeding". Lesson: never trust a boot check unless `npm run build` exited clean — added web `--noEmit` typecheck into the build script.
