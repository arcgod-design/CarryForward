# topics/tactics.md

Only techniques that actually saved time in this build.

- **Prove the risky dependency first, then build on it:** `better-sqlite3`'s native binary was smoke-tested (`new Database(':memory:')` + exec) before a single line of storage code was written. Its failure mode (Windows native builds) would have invalidated the whole spec.
- **One live-boot check per slice (real server + real HTTP):** unit tests passed several times while the compiled server crashed (async routes, FK mismatches). Booting `dist` and hitting endpoints with PowerShell `Invoke-RestMethod` caught every integration bug the unit suite couldn't.
- **Full-loop e2e through the real API, no mocking layer:** `buildApp()` refactor (listen only under `require.main`) let tests boot the real app on port 0 and run the entire P0 acceptance loop with plain `fetch` — zero new dependencies, and it exercises exactly what the demo video shows.
- **Key-stamping at persistence boundaries:** generating ids deep in domain logic (checker) and again at the route caused the FK bug; assigning identity at the single save boundary fixed the class of bug, not the instance.
- **Condition signatures for user-dismissable flags:** hashing (node, condition, file) made "dismissed stays dismissed while nothing changed" a one-line upsert rule instead of diffing flag trees.
