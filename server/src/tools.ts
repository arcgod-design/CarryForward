import { execFile } from "child_process";
import { promisify } from "util";
import fsSync from "fs";
import path from "path";
import type { Project } from "../../shared/types";

const exec = promisify(execFile);

export function graphifyArtifactPath(project: Project): string | null {
  const p = path.join(project.rootPath, "graphify-out", "graph.html");
  return fsSync.existsSync(p) ? p : null;
}

export async function runGraphify(project: Project): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await exec("graphify", ["."], {
      cwd: project.rootPath,
      shell: true,
      timeout: 600000,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return {
        ok: false,
        error:
          "The graphify CLI is not installed or not on PATH. Install it with: uv tool install graphifyy (then: graphify install). It is open source (Apache-2.0/MIT) from graphify.com.",
      };
    }
    return { ok: false, error: `graphify failed: ${(e.message || String(e)).slice(0, 400)}` };
  }
  return graphifyArtifactPath(project) ? { ok: true } : { ok: false, error: "graphify ran but did not produce graphify-out/graph.html." };
}
