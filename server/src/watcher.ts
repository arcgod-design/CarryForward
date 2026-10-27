import path from "path";
import chokidar, { type FSWatcher } from "chokidar";
import { refreshProject } from "./maintenance";
import * as store from "./store";
import type { Project } from "../../shared/types";

const EXCLUDED_DIRS = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "__pycache__",
  "venv",
  ".venv",
  "target",
  ".cache",
];

const watchers = new Map<string, FSWatcher>();

interface WatchState {
  watching: boolean;
  lastEvent: string | null;
  lastRefresh: string | null;
  error: string | null;
}

const state = new Map<string, WatchState>();

export function watchStatus(projectId: string): WatchState {
  return state.get(projectId) ?? { watching: false, lastEvent: null, lastRefresh: null, error: null };
}

export function startWatch(project: Project): { started: boolean; note: string } {
  if (watchers.has(project.id)) {
    return { started: true, note: "Already watching." };
  }
  const s: WatchState = { watching: true, lastEvent: null, lastRefresh: null, error: null };
  state.set(project.id, s);

  const ignored = [
    ...EXCLUDED_DIRS.map((d) => path.join(project.rootPath, d)),
    ...EXCLUDED_DIRS.map((d) => path.join(project.rootPath, "**", d, "**")),
    /(^|[/\\])\.(env|npmrc|netrc)/,
    /\.(pem|key|p12|pfx)$/i,
  ];

  let timer: NodeJS.Timeout | null = null;
  let pending: string | null = null;

  const watcher = chokidar.watch(project.rootPath, {
    ignored,
    persistent: true,
    ignoreInitial: true,
    depth: 12,
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 250 },
  });

  async function refresh(): Promise<void> {
    if (!pending) return;
    const changed = pending;
    pending = null;
    try {
      await refreshProject(project);
      s.lastRefresh = new Date().toISOString();
      s.error = null;
    } catch (err) {
      s.error = `Refresh after change (${changed}) failed: ${(err as Error).message}`;
    }
  }

  watcher.on("all", (event: string, filePath: string) => {
    s.lastEvent = `${event} ${path.relative(project.rootPath, filePath)} at ${new Date().toISOString()}`;
    pending = path.relative(project.rootPath, filePath);
    if (timer) clearTimeout(timer);
    timer = setTimeout(refresh, 1500);
  });
  watcher.on("error", (err: Error) => {
    s.error = `Watcher error: ${err.message}. Manual refresh remains available.`;
  });

  watchers.set(project.id, watcher);
  return { started: true, note: "Watching for changes. Manual refresh always remains available." };
}

export function stopWatch(projectId: string): void {
  const watcher = watchers.get(projectId);
  if (watcher) {
    void watcher.close();
    watchers.delete(projectId);
  }
  const s = state.get(projectId);
  if (s) s.watching = false;
}

export function stopAll(): void {
  for (const id of [...watchers.keys()]) stopWatch(id);
}

export function isWatching(projectId: string): boolean {
  return watchers.has(projectId);
}

export function getWatchedProject(projectId: string): Project | undefined {
  return store.getProject(projectId);
}
