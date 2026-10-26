import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { getDb, closeDb, dbPath } from "./db";
import * as store from "./store";
import type { ScannedFile } from "../../shared/types";

let tmpFile: string;

beforeEach(() => {
  tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cf-db-")), "test.db");
  process.env.CF_DB_PATH = tmpFile;
  closeDb();
});

afterEach(() => {
  closeDb();
  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
  delete process.env.CF_DB_PATH;
});

function sampleFile(rel: string): ScannedFile {
  return {
    relativePath: rel,
    size: 10,
    mtime: new Date().toISOString(),
    contentHash: "abc",
    parseStatus: "parsed",
    skipReason: null,
  };
}

describe("store persistence", () => {
  it("creates a project and finds it by root", () => {
    const p = store.createProject("C:\\some\\repo", "repo");
    expect(store.getProject(p.id)?.displayName).toBe("repo");
    expect(store.getProjectByRoot("C:\\some\\repo")?.id).toBe(p.id);
  });

  it("persists across a database reopen", () => {
    const p = store.createProject("C:\\some\\repo", "repo");
    store.replaceSourceFiles(p.id, [sampleFile("a.md")], [
      { relativePath: ".git", size: 0, mtime: null, contentHash: null, parseStatus: "skipped", skipReason: "excluded" },
    ] as ScannedFile[]);
    closeDb();

    expect(dbPath()).toBe(tmpFile);
    const files = store.getSourceFiles(p.id);
    expect(files.length).toBe(2);
    expect(files.map((f) => f.relativePath).sort()).toEqual([".git", "a.md"]);
  });

  it("replaces source files on rescan", () => {
    const p = store.createProject("C:\\some\\repo", "repo");
    store.replaceSourceFiles(p.id, [sampleFile("old.md")], []);
    store.replaceSourceFiles(p.id, [sampleFile("new.md")], []);
    const files = store.getSourceFiles(p.id);
    expect(files.map((f) => f.relativePath)).toEqual(["new.md"]);
  });

  it("deleting a project cascades to its files", () => {
    const p = store.createProject("C:\\some\\repo", "repo");
    store.replaceSourceFiles(p.id, [sampleFile("a.md")], []);
    store.deleteProject(p.id);
    expect(store.getProject(p.id)).toBeUndefined();
    expect(store.getSourceFiles(p.id)).toEqual([]);
  });

  it("runs migrations idempotently", () => {
    const db = getDb();
    const version = db.pragma("user_version", { simple: true });
    expect(version).toBe(1);
    closeDb();
    getDb();
    expect(getDb().pragma("user_version", { simple: true })).toBe(1);
  });
});
