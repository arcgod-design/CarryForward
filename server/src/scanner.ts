import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import { isSecretFileName } from "./secrets";
import type { ScannedFile } from "../../shared/types";

const EXCLUDED_DIRS = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  "bower_components",
  "vendor",
  "dist",
  "build",
  "out",
  "coverage",
  "__pycache__",
  "venv",
  ".venv",
  "target",
  ".cache",
  ".gradle",
  ".turbo",
  ".next",
  ".nuxt",
  ".terraform",
  ".idea",
]);

const TEXT_EXTS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".css",
  ".scss",
  ".html",
  ".sh",
  ".bash",
  ".ps1",
  ".sql",
]);

const TEXT_FILE_NAMES = new Set([
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".env.example",
  ".prettierrc",
  ".babelrc",
  ".nvmrc",
]);

export interface ScanOptions {
  maxFiles?: number;
  maxDepth?: number;
  maxReadSize?: number;
}

export interface ScanResult {
  files: ScannedFile[];
  skipped: ScannedFile[];
  truncated: boolean;
}

function record(
  relativePath: string,
  size: number,
  mtime: string | null,
  parseStatus: ScannedFile["parseStatus"],
  skipReason: string | null,
  contentHash: string | null = null
): ScannedFile {
  return { relativePath, size, mtime, contentHash, parseStatus, skipReason };
}

export async function scanRepository(root: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const maxFiles = opts.maxFiles ?? 5000;
  const maxDepth = opts.maxDepth ?? 12;
  const maxReadSize = opts.maxReadSize ?? 512 * 1024;

  const files: ScannedFile[] = [];
  const skipped: ScannedFile[] = [];
  let truncated = false;

  const queue: string[] = ["."];
  let dirsSeen = 0;

  const total = () => files.length + skipped.length;

  while (queue.length > 0) {
    const relDir = queue.shift() as string;
    const absDir = relDir === "." ? root : path.join(root, relDir);

    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code || "unknown";
      if (relDir === ".") throw err;
      skipped.push(record(relDir, 0, null, "error", `unreadable directory (${code})`));
      continue;
    }

    dirsSeen += 1;
    if (dirsSeen > 4000) {
      truncated = true;
      break;
    }

    for (const entry of entries) {
      if (total() >= maxFiles) {
        truncated = true;
        break;
      }

      const childRel = relDir === "." ? entry.name : path.join(relDir, entry.name).split(path.sep).join("/");
      const absChild = path.join(root, childRel);

      if (entry.isSymbolicLink()) {
        skipped.push(record(childRel, 0, null, "skipped", "symlink not followed"));
        continue;
      }

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) {
          skipped.push(record(childRel, 0, null, "skipped", `excluded directory (${entry.name})`));
          continue;
        }
        const depth = childRel.split("/").length;
        if (depth > maxDepth) {
          skipped.push(record(childRel, 0, null, "skipped", "depth limit reached"));
          continue;
        }
        queue.push(childRel);
        continue;
      }

      if (!entry.isFile()) continue;

      if (isSecretFileName(entry.name)) {
        skipped.push(record(childRel, 0, null, "skipped", "possible secret/credential file (not read)"));
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      const isText = TEXT_EXTS.has(ext) || TEXT_FILE_NAMES.has(entry.name.toLowerCase());

      if (!isText) {
        skipped.push(record(childRel, 0, null, "skipped", "binary or unsupported file type"));
        continue;
      }

      let st;
      try {
        st = await fs.stat(absChild);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code || "unknown";
        skipped.push(record(childRel, 0, null, "error", `unreadable file (${code})`));
        continue;
      }

      if (st.size > maxReadSize) {
        skipped.push(record(childRel, st.size, st.mtime.toISOString(), "skipped", "file too large to read"));
        continue;
      }

      try {
        const content = await fs.readFile(absChild);
        const hash = createHash("sha256").update(content).digest("hex");
        files.push(record(childRel, st.size, st.mtime.toISOString(), "parsed", null, hash));
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code || "unknown";
        skipped.push(record(childRel, st.size, st.mtime.toISOString(), "error", `read failed (${code})`));
      }
    }

    if (truncated) break;
  }

  return { files, skipped, truncated };
}
