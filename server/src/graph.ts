import { createHash } from "crypto";
import path from "path";
import fsSync from "fs";
import { discoverFromScan, type ParsedFileInfo, type ExtractedItem } from "./extractor";
import type { KnowledgeNode, KnowledgeEdge, Evidence } from "../../shared/types";

export interface BuiltKnowledge {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  evidence: Evidence[];
  parseErrors: { sourcePath: string; message: string }[];
  truncated: boolean;
}

function sha(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function isCodePath(rel: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt)$/i.test(rel);
}

export async function buildKnowledge(projectId: string, root: string, parsedFiles: ParsedFileInfo[]): Promise<BuiltKnowledge> {
  const now = new Date().toISOString();
  const extraction = await discoverFromScan(root, parsedFiles);
  const items = extraction.items;
  const hashByPath = new Map(parsedFiles.map((f) => [f.relativePath, f.contentHash ?? null]));

  const nodeIds = new Map<string, string>();
  const nodes: KnowledgeNode[] = [];
  const evidence: Evidence[] = [];
  function itemNodeId(item: ExtractedItem): string {
    const key = sha(projectId, item.sourcePath, String(item.startLine), item.type, item.title);
    nodeIds.set(nodeKey(item), key);
    return key;
  }

  function nodeKey(item: ExtractedItem): string {
    return `${item.type}:${item.sourcePath}:${item.startLine}`;
  }

  for (const item of items) {
    const id = itemNodeId(item);
    nodes.push({
      id,
      projectId,
      type: item.type,
      title: item.title,
      content: item.content,
      status: "candidate",
      origin: "discovered",
      approvedBy: null,
      approvedAt: null,
      supersedes: null,
      createdAt: now,
      updatedAt: now,
    });
    evidence.push({
      id: sha(projectId, id, String(item.startLine)),
      projectId,
      nodeId: id,
      sourcePath: item.sourcePath,
      startLine: item.startLine,
      endLine: item.endLine,
      excerpt: item.excerpt,
      classification: item.classification,
      observedAt: now,
      confidence: item.confidence,
      contentHash: hashByPath.get(item.sourcePath) ?? null,
    });
  }

  const components = buildComponents(projectId, root, parsedFiles, now);
  for (const c of components) {
    if (nodeIds.has(`component:${c.content}`)) continue;
    nodeIds.set(`component:${c.content}`, c.id);
    nodes.push(c.node);
    evidence.push(c.evidence);
  }

  const importFlow = await extractImportFlow(projectId, root, components, parsedFiles, now);

  const edges: KnowledgeEdge[] = [];
  edges.push(...importFlow.edges);
  evidence.push(...importFlow.evidence);

  const byType = new Map<string, ExtractedItem[]>();
  for (const item of items) {
    const list = byType.get(item.type) ?? [];
    list.push(item);
    byType.set(item.type, list);
  }

  const componentNames = components.map((c) => c.name);
  for (const item of items) {
    if (item.type !== "principle" && item.type !== "convention") continue;
    const mentioned = componentNames.find((name) => new RegExp(`\\b${name}\\b`, "i").test(item.content) || new RegExp(`\\b${name}\\b`, "i").test(item.title));
    if (!mentioned) continue;
    const compEntry = components.find((c) => c.name === mentioned);
    if (!compEntry) continue;
    const sourceId = nodeIds.get(nodeKey(item));
    if (!sourceId || sourceId === compEntry.id) continue;
    edges.push({
      id: sha(projectId, sourceId, compEntry.id, "governs"),
      projectId,
      sourceNodeId: sourceId,
      targetNodeId: compEntry.id,
      relation: "governs",
      status: "candidate",
      evidenceId: sha(projectId, sourceId, String(item.startLine)),
      origin: "discovered",
    });
  }

  const decisions = items.filter((i) => i.type === "decision");
  for (const newer of decisions) {
    if (newer.supersedesNumber === undefined) continue;
    const older = decisions.find((d) => d.adrNumber === newer.supersedesNumber && d !== newer);
    if (!older) continue;
    const newerId = nodeIds.get(nodeKey(newer));
    const olderId = nodeIds.get(nodeKey(older));
    if (!newerId || !olderId) continue;
    edges.push({
      id: sha(projectId, newerId, olderId, "supersedes"),
      projectId,
      sourceNodeId: newerId,
      targetNodeId: olderId,
      relation: "supersedes",
      status: "candidate",
      evidenceId: sha(projectId, newerId, String(newer.startLine)),
      origin: "discovered",
    });
  }

  const verification = nodes.find((n) => n.type === "verification");
  const srcComponent = components.find((c) => c.name === "src");
  const testFiles = parsedFiles.filter((f) => /\.(test|spec)\.[a-z]+$/i.test(f.relativePath));
  if (verification && srcComponent && testFiles.length > 0) {
    edges.push({
      id: sha(projectId, srcComponent.id, verification.id, "verified_by"),
      projectId,
      sourceNodeId: srcComponent.id,
      targetNodeId: verification.id,
      relation: "verified_by",
      status: "candidate",
      evidenceId: verification.id ? evidence.find((e) => e.nodeId === verification.id)?.id ?? null : null,
      origin: "discovered",
    });
  }

  return { nodes, edges, evidence, parseErrors: extraction.parseErrors, truncated: extraction.truncated };
}

interface ComponentEntry {
  id: string;
  name: string;
  content: string;
  node: KnowledgeNode;
  evidence: Evidence;
}

const IMPORT_PATTERNS = [
  /(?:import[^'"`\n]*from\s*|export[^'"`\n]*from\s*|require\s*\(\s*|import\s*\(\s*)["']([^"']+)["']/g,
  /from\s+([.\w]+)\s+import/g,
];

const MAX_IMPORT_EDGES = 200;

async function extractImportFlow(
  projectId: string,
  root: string,
  components: ComponentEntry[],
  parsedFiles: ParsedFileInfo[],
  now: string
): Promise<{ edges: KnowledgeEdge[]; evidence: Evidence[] }> {
  const nameToId = new Map(components.map((c) => [c.name, c.id]));
  const edges: KnowledgeEdge[] = [];
  const evidence: Evidence[] = [];
  if (nameToId.size === 0) return { edges, evidence };

  const codeFiles = parsedFiles.filter((f) => isCodePath(f.relativePath)).slice(0, 400);
  const byPair = new Map<string, { from: string; to: string; file: string; line: number; excerpt: string }>();

  for (const f of codeFiles) {
    if (byPair.size >= MAX_IMPORT_EDGES) break;
    const fromTop = f.relativePath.includes("/") ? f.relativePath.split("/")[0] : null;
    if (!fromTop || !nameToId.has(fromTop)) continue;
    let content: string;
    try {
      content = await fsSync.promises.readFile(path.join(root, f.relativePath), "utf8");
    } catch {
      continue;
    }
    if (content.length > 256 * 1024) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length && byPair.size < MAX_IMPORT_EDGES; i++) {
      const line = lines[i];
      for (const re of IMPORT_PATTERNS) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
          const spec = m[1];
          if (!spec) continue;
          let top: string | null = null;
          if (spec.startsWith(".")) {
            const base = path.posix.dirname(f.relativePath);
            top = path.posix.normalize(`${base}/${spec}`).split("/")[0];
          } else {
            let candidate = spec.split("/")[0];
            if (candidate.startsWith("@")) {
              const rest = spec.slice(candidate.length + 1);
              const restTop = rest.split("/")[0];
              if (restTop && nameToId.has(restTop)) {
                top = restTop;
              } else {
                const unscoped = candidate.slice(1);
                top = nameToId.has(unscoped) ? unscoped : null;
              }
            } else {
              top = nameToId.has(candidate) ? candidate : null;
            }
          }
          if (!top || top === fromTop || !nameToId.has(top)) continue;
          const key = `${fromTop}>${top}`;
          if (!byPair.has(key)) {
            byPair.set(key, { from: fromTop, to: top, file: f.relativePath, line: i + 1, excerpt: line.trim().slice(0, 140) });
          }
        }
      }
    }
  }

  for (const pair of byPair.values()) {
    const sourceId = nameToId.get(pair.from) as string;
    const targetId = nameToId.get(pair.to) as string;
    const evId = sha(projectId, "import", pair.file, String(pair.line), pair.from, pair.to);
    edges.push({
      id: sha(projectId, sourceId, targetId, "depends_on"),
      projectId,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      relation: "depends_on",
      status: "candidate",
      evidenceId: evId,
      origin: "discovered",
    });
    evidence.push({
      id: evId,
      projectId,
      nodeId: sourceId,
      sourcePath: pair.file,
      startLine: pair.line,
      endLine: pair.line,
      excerpt: pair.excerpt,
      classification: "observed-convention",
      observedAt: now,
      confidence: "high",
      contentHash: null,
    });
  }
  return { edges, evidence };
}

const GENERATED_DIRS = new Set([
  "graphify-out",
  "coverage",
  "__pycache__",
  "venv",
  "dist",
  "build",
  "out",
  "tmp",
  "temp",
]);

function buildComponents(projectId: string, root: string, parsedFiles: ParsedFileInfo[], now: string): ComponentEntry[] {
  const byDir = new Map<string, ParsedFileInfo[]>();
  for (const f of parsedFiles) {
    const top = f.relativePath.includes("/") ? f.relativePath.split("/")[0] : "";
    if (!top || top === "docs" || top === ".github" || top === "weeks" || top === "doc-of-journey") continue;
    const list = byDir.get(top) ?? [];
    list.push(f);
    byDir.set(top, list);
  }
  const entries: ComponentEntry[] = [];
  for (const [name, files] of [...byDir.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 50)) {
    const codeCount = files.filter((f) => isCodePath(f.relativePath)).length;
    if (codeCount === 0) continue;
    if (name.startsWith(".") || GENERATED_DIRS.has(name)) continue;
    const exemplar = (codeCount > 0 ? files.find((f) => isCodePath(f.relativePath)) : files[0]) as ParsedFileInfo;
    const id = sha(projectId, "component", name);
    let firstLine = `(file in ${name}/)`;
    try {
      const raw = fsSync.readFileSync(path.join(root, exemplar.relativePath), "utf8");
      firstLine = raw.split(/\r?\n/)[0].slice(0, 120) || firstLine;
    } catch {
      firstLine = `(file in ${name}/)`;
    }
    const node: KnowledgeNode = {
      id,
      projectId,
      type: "component",
      title: `Component: ${name}/`,
      content: `Directory ${name}/ with ${files.length} tracked file(s)${codeCount > 0 ? `, ${codeCount} source file(s)` : ""}.`,
      status: "source-claim",
      origin: "discovered",
      approvedBy: null,
      approvedAt: null,
      supersedes: null,
      createdAt: now,
      updatedAt: now,
    };
    const evidence: Evidence = {
      id: sha(projectId, id, "component-evidence"),
      projectId,
      nodeId: id,
      sourcePath: exemplar.relativePath,
      startLine: 1,
      endLine: 1,
      excerpt: firstLine,
      classification: "observed-convention",
      observedAt: now,
      confidence: "medium",
    };
    entries.push({ id, name, content: name, node, evidence });
  }
  return entries;
}
