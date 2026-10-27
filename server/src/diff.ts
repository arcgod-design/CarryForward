import { execFile } from "child_process";
import { promisify } from "util";
import parseDiff from "parse-diff";
import { redactSecrets } from "./secrets";
import type { DiffFile, DiffHunk, DiffSource } from "../../shared/types";

const exec = promisify(execFile);

export async function captureGitDiff(root: string, source: DiffSource): Promise<string> {
  const args =
    source === "staged"
      ? ["diff", "--cached"]
      : source === "unstaged"
        ? ["diff"]
        : ["diff", "HEAD"];
  const { stdout } = await exec("git", ["-C", root, ...args], {
    maxBuffer: 20 * 1024 * 1024,
    timeout: 15000,
  });
  return stdout;
}

export async function currentCommit(root: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["-C", root, "rev-parse", "HEAD"], { timeout: 10000 });
    const hash = stdout.trim();
    return /^[0-9a-f]{7,40}$/i.test(hash) ? hash : null;
  } catch {
    return null;
  }
}

export function parseDiffText(
  text: string
): { files: DiffFile[]; redactions: string[] } {
  if (!text || text.trim().length === 0) return { files: [], redactions: [] };
  const raw = parseDiff(text);
  const files: DiffFile[] = [];
  const redactions = new Set<string>();

  for (const f of raw) {
    const hunks: DiffHunk[] = (f.chunks ?? []).map((chunk: any) => ({
      oldStart: chunk.oldStart,
      newStart: chunk.newStart,
      changes: (chunk.changes ?? []).map((c: any) => {
        const rawLine = String(c.content ?? "");
        const { redacted, found } = redactSecrets(rawLine);
        for (const name of found) redactions.add(name);
        return {
          type: (c.type === "add" || c.type === "del" ? c.type : "normal") as "add" | "del" | "normal",
          lineNumber: typeof c.ln === "number" ? c.ln : typeof c.ln1 === "number" ? c.ln1 : null,
          content: redacted,
          redacted: found.length > 0,
        };
      }),
    }));
    const path = f.to && f.to.length > 0 ? f.to : f.from;
    if (!path || path === "/dev/null") continue;
    if (hunks.length === 0) continue;
    files.push({ path, oldPath: f.from ?? path, hunks });
  }

  return { files, redactions: [...redactions] };
}
