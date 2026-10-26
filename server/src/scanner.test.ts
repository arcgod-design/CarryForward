import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { scanRepository } from "./scanner";

let tmp: string;

function mkfile(rel: string, content: string): void {
  const target = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function mkdir(rel: string): void {
  fs.mkdirSync(path.join(tmp, rel), { recursive: true });
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-scan-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("scanRepository", () => {
  it("stays inside the root and records excluded directories with reasons", async () => {
    mkfile("README.md", "# demo\n");
    mkfile("src/a.ts", "export const a = 1;\n");
    mkdir(".git");
    mkfile(".git/config", "[core]");
    mkdir("node_modules/pkg");
    mkfile("node_modules/pkg/index.js", "x");

    const result = await scanRepository(tmp);

    const paths = result.files.map((f) => f.relativePath).sort();
    expect(paths).toEqual(["README.md", "src/a.ts"]);

    const skipped = result.skipped.map((s) => s.relativePath);
    expect(skipped).toContain(".git");
    expect(skipped).toContain("node_modules");
    const gitSkip = result.skipped.find((s) => s.relativePath === ".git");
    expect(gitSkip?.skipReason).toContain("excluded directory");
    expect(result.truncated).toBe(false);
  });

  it("never reads secret-named files but allows .env.example", async () => {
    mkfile(".env", "PASSWORD=hunter2secret\n");
    mkfile(".env.production", "TOKEN=abc\n");
    mkfile(".env.example", "PASSWORD=change-me\n");
    mkfile("server.key", "-----BEGIN PRIVATE KEY-----\n");
    mkfile("README.md", "docs\n");

    const result = await scanRepository(tmp);

    const paths = result.files.map((f) => f.relativePath);
    expect(paths).toContain(".env.example");
    expect(paths).toContain("README.md");
    expect(paths).not.toContain(".env");
    expect(paths).not.toContain(".env.production");
    expect(paths).not.toContain("server.key");

    const envSkip = result.skipped.find((s) => s.relativePath === ".env");
    expect(envSkip?.skipReason).toContain("secret");
  });

  it("does not follow symlinks", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "cf-outside-"));
    fs.writeFileSync(path.join(outside, "outside.txt"), "leaked");
    fs.symlinkSync(outside, path.join(tmp, "link"), "junction");

    const result = await scanRepository(tmp);
    fs.rmSync(outside, { recursive: true, force: true });

    const linkSkip = result.skipped.find((s) => s.relativePath === "link");
    expect(linkSkip?.skipReason).toContain("symlink");
    expect(result.files.map((f) => f.relativePath)).not.toContain("link");
  });

  it("records binary or unsupported files as skipped", async () => {
    mkfile("logo.png", "not really a png");
    mkfile("notes.md", "text");
    const result = await scanRepository(tmp);
    const png = result.skipped.find((s) => s.relativePath === "logo.png");
    expect(png?.skipReason).toContain("unsupported");
    expect(result.files.map((f) => f.relativePath)).toContain("notes.md");
  });

  it("respects the maxFiles cap and reports truncation", async () => {
    mkfile("a.md", "1");
    mkfile("b.md", "2");
    mkfile("c.md", "3");
    const result = await scanRepository(tmp, { maxFiles: 2 });
    expect(result.truncated).toBe(true);
    expect(result.files.length + result.skipped.length).toBe(2);
  });

  it("records size, mtime and a sha256 hash for parsed files", async () => {
    mkfile("hello.md", "content");
    const result = await scanRepository(tmp);
    const f = result.files[0];
    expect(f.size).toBe(7);
    expect(f.mtime).toBeTruthy();
    expect(f.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(f.parseStatus).toBe("parsed");
  });
});
