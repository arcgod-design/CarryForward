import { promises as fs } from "fs";
import path from "path";
import { findSecrets } from "./secrets";
import type { EvidenceClassification, NodeType } from "../../shared/types";

export type FileRole =
  | "agent-instructions"
  | "core"
  | "status"
  | "entry"
  | "decision-record"
  | "topic-memory"
  | "week-record"
  | "docs"
  | "manifest"
  | "config"
  | "code"
  | "other";

export interface ExtractedItem {
  type: NodeType;
  title: string;
  content: string;
  classification: EvidenceClassification;
  confidence: "high" | "medium" | "low";
  sourcePath: string;
  startLine: number;
  endLine: number;
  excerpt: string;
  adrNumber?: number;
  supersedesNumber?: number;
}

export interface ExtractionResult {
  items: ExtractedItem[];
  parseErrors: { sourcePath: string; message: string }[];
  truncated: boolean;
}

const AGENT_INSTRUCTION_FILES = new Set([
  "agents.md",
  "claude.md",
  ".github/copilot-instructions.md",
  ".cursorrules",
  ".windsurfrules",
]);

const CORE_FILES = new Set(["project-core.md", "project_core.md"]);
const STATUS_FILES = new Set([
  "project-status.md",
  "project_status.md",
  "session-state.md",
  "next-tasks.md",
  "user-thing-to-do.md",
]);
const ENTRY_FILES = new Set(["readme.md", "contributing.md", "security.md"]);

const MANIFEST_FILES = new Set(["package.json", "tsconfig.json", "pyproject.toml", "go.mod", "cargo.toml", "pom.xml", "gemfile", "requirements.txt"]);

const CONFIG_PATTERNS = [/\.config\.(js|ts|mjs|cjs|json)$/i, /^\.eslintrc/i, /^eslint\.config\./i, /^\.prettierrc/i, /^vitest\.config\./i, /^jest\.config\./i, /^playwright\.config\./i, /\.editorconfig$/i];

const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".kt"]);

export function fileRole(relativePath: string): FileRole {
  const rel = relativePath.toLowerCase();
  const name = path.basename(rel);
  if (AGENT_INSTRUCTION_FILES.has(rel)) return "agent-instructions";
  if (CORE_FILES.has(name)) return "core";
  if (STATUS_FILES.has(name)) return "status";
  if (ENTRY_FILES.has(name)) return "entry";
  if (/(^|\/)(doc-of-journey\/)?(decisions|adr)s?\/\d{2,}[^/]*\.md$/.test(rel)) return "decision-record";
  if (/(^|\/)doc-of-journey\/topics\//.test(rel)) return "topic-memory";
  if (/(^|\/)weeks\/(week-)?[^/]+\.md$/.test(rel)) return "week-record";
  if (/(^|\/)docs\//.test(rel)) return "docs";
  if (MANIFEST_FILES.has(name)) return "manifest";
  if (CONFIG_PATTERNS.some((p) => p.test(name))) return "config";
  if (CODE_EXTS.has(path.extname(name))) return "code";
  return "other";
}

const RULE_WORD_RE = /\b(must not|shall not|must\b|shall\b|never\b|always\b|required to\b|forbidden|do not\b|don't\b|is not allowed|not permitted|should always|only via|no direct)\b/i;
const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const STATUS_LINE_RE = /^[-*\s]*(.+?)\s*[—:|-]\s*(WORKING|PROTO|ROADMAP|DONE|BLOCKED|FAILED|UNVERIFIED)\b/i;
const TODO_RE = /\b(TODO|FIXME|OPEN QUESTION)\b/i;
const SUPERSEDES_RE = /supersedes?\s*(?:adr[- #]*)?(\d{1,4})/i;

const MAX_RULE_ITEMS = 120;
const MAX_OPEN_QUESTIONS = 20;
const MAX_ITEM_TOTAL = 400;

function cleanExcerpt(line: string): string {
  let text = line.replace(LIST_ITEM_RE, "").trim();
  if (text.length > 240) text = text.slice(0, 237) + "...";
  return text;
}

function titleFrom(text: string): string {
  let t = text.replace(LIST_ITEM_RE, "").trim();
  if (t.length > 80) t = t.slice(0, 77).replace(/\s+\S*$/, "") + "...";
  return t;
}

function typeFromHeading(heading: string): NodeType | null {
  const h = heading.toLowerCase();
  if (/(principle|rule|policy|constraint|guardrail|non-negot|core value)/.test(h)) return "principle";
  if (/(convention|style|format|naming|standard)/.test(h)) return "convention";
  if (/(procedure|workflow|process|how to|workflow|steps)/.test(h)) return "procedure";
  if (/(decision|adr)/.test(h)) return "decision";
  if (/(status|state|progress|capability)/.test(h)) return "status-question";
  return null;
}

function defaultTypeForRole(role: FileRole): NodeType {
  if (role === "entry") return "convention";
  return "principle";
}

function classificationForRole(role: FileRole): EvidenceClassification {
  switch (role) {
    case "agent-instructions":
    case "core":
      return "explicit-rule";
    case "entry":
      return "observed-convention";
    default:
      return "inferred-candidate";
  }
}

function parseMarkdown(content: string, role: FileRole, rel: string, counters: { rules: number; open: number }, out: ExtractedItem[]): void {
  const lines = content.split(/\r?\n/);
  let currentHeading = "";
  let ruleCount = 0;
  let openCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    const headingMatch = raw.match(HEADING_RE);
    if (headingMatch) {
      currentHeading = headingMatch[2].trim();
      continue;
    }

    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.length < 8) continue;

    if (role === "status") {
      const statusMatch = trimmed.match(STATUS_LINE_RE);
      if (statusMatch && ruleCount < 40) {
        const label = statusMatch[1].replace(/[-*]\s*/, "").trim();
        out.push({
          type: "status-question",
          title: `Status claim: ${titleFrom(label)} — ${statusMatch[2].toUpperCase()}`,
          content: cleanExcerpt(trimmed),
          classification: "status-claim",
          confidence: "high",
          sourcePath: rel,
          startLine: lineNo,
          endLine: lineNo,
          excerpt: cleanExcerpt(trimmed),
        });
        continue;
      }
    }

    if (TODO_RE.test(trimmed) && !trimmed.startsWith("<!--")) {
      if (openCount < MAX_OPEN_QUESTIONS && counters.open < MAX_OPEN_QUESTIONS) {
        openCount++;
        counters.open++;
        out.push({
          type: "status-question",
          title: titleFrom(trimmed),
          content: cleanExcerpt(trimmed),
          classification: "open-question",
          confidence: "medium",
          sourcePath: rel,
          startLine: lineNo,
          endLine: lineNo,
          excerpt: cleanExcerpt(trimmed),
        });
      }
      continue;
    }

    const hasRuleWord = RULE_WORD_RE.test(trimmed);
    if (!hasRuleWord) continue;

    const isListItem = LIST_ITEM_RE.test(raw);
    const headingType = typeFromHeading(currentHeading);
    const strongContext = role === "agent-instructions" || role === "core" || headingType !== null;
    if (!isListItem && !strongContext) continue;
    if (isListItem && !strongContext && role === "docs") continue;
    if (counters.rules >= MAX_RULE_ITEMS) continue;

    if (findSecrets(trimmed).length > 0) continue;

    counters.rules++;
    ruleCount++;
    out.push({
      type: headingType ?? defaultTypeForRole(role),
      title: titleFrom(trimmed),
      content: cleanExcerpt(trimmed),
      classification: classificationForRole(role),
      confidence: role === "agent-instructions" || role === "core" ? (isListItem ? "high" : "medium") : "medium",
      sourcePath: rel,
      startLine: lineNo,
      endLine: lineNo,
      excerpt: cleanExcerpt(trimmed),
    });
  }
}

function parseDecisionRecord(content: string, rel: string, out: ExtractedItem[]): void {
  const lines = content.split(/\r?\n/);
  let title = path.basename(rel, ".md").replace(/-/g, " ");
  let adrNumber: number | undefined;
  const numMatch = path.basename(rel).match(/^(\d{1,4})/);
  if (numMatch) adrNumber = Number(numMatch[1]);

  let status = "";
  let decisionStart = -1;
  let decisionEnd = -1;
  let supersedesNumber: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch && headingMatch[1].length === 1 && title === path.basename(rel, ".md").replace(/-/g, " ")) {
      title = headingMatch[2].trim();
    }
    const statusMatch = trimmed.match(/^\**status\**\s*[:=]\s*(\S+)/i);
    if (statusMatch) status = statusMatch[1];
    if (headingMatch && /^decision$/i.test(headingMatch[2].trim())) {
      decisionStart = i + 1;
    } else if (decisionStart >= 0 && headingMatch) {
      decisionEnd = i;
      break;
    }
    const supMatch = trimmed.match(SUPERSEDES_RE) ?? (headingMatch ? headingMatch[2].match(SUPERSEDES_RE) : null);
    if (supMatch) supersedesNumber = Number(supMatch[1]);
  }
  if (decisionStart >= 0 && decisionEnd < 0) decisionEnd = lines.length;

  let contentText = title;
  let startLine = 1;
  let endLine = 1;
  if (decisionStart >= 0) {
    let s = decisionStart;
    while (s < decisionEnd && lines[s].trim() === "") s++;
    let e = decisionEnd - 1;
    while (e >= s && lines[e].trim() === "") e--;
    if (e >= s) {
      const section = lines.slice(s, e + 1).join(" ").trim();
      contentText = section.length > 600 ? section.slice(0, 597) + "..." : section;
      startLine = s + 1;
      endLine = e + 1;
    }
  }

  const displayTitle = (adrNumber !== undefined ? `ADR ${String(adrNumber).padStart(4, "0")}: ` : "") + titleFrom(title);
  const excerpt = (status ? `Status: ${status}. ` : "") + (contentText.length > 200 ? contentText.slice(0, 197) + "..." : contentText);
  if (findSecrets(excerpt).length > 0) return;

  out.push({
    type: "decision",
    title: displayTitle,
    content: excerpt,
    classification: "documented-decision",
    confidence: "high",
    sourcePath: rel,
    startLine,
    endLine,
    excerpt,
    adrNumber,
    supersedesNumber,
  });
}

function lineOf(text: string, needle: string): number {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i + 1;
  }
  return 1;
}

function parsePackageJson(content: string, rel: string, out: ExtractionResult): void {
  let manifest: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    manifest = JSON.parse(content);
  } catch (err) {
    out.parseErrors.push({ sourcePath: rel, message: `invalid JSON: ${(err as Error).message}` });
    return;
  }
  const knownScripts = ["test", "lint", "typecheck", "build", "start", "format"];
  for (const key of knownScripts) {
    const cmd = manifest.scripts?.[key];
    if (cmd) {
      out.items.push({
        type: "procedure",
        title: `Procedure: npm run ${key}`,
        content: `The project defines \`npm run ${key}\` → ${cmd}`,
        classification: "observed-convention",
        confidence: "high",
        sourcePath: rel,
        startLine: lineOf(content, `"${key}"`),
        endLine: lineOf(content, `"${key}"`),
        excerpt: `"${key}": "${cmd}"`,
      });
    }
  }
  const deps = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
  for (const [name, version] of Object.entries(deps).slice(0, 60)) {
    out.items.push({
      type: "dependency",
      title: `Dependency: ${name}`,
      content: `${name} ${version}`,
      classification: "observed-convention",
      confidence: "high",
      sourcePath: rel,
      startLine: lineOf(content, `"${name}"`),
      endLine: lineOf(content, `"${name}"`),
      excerpt: `"${name}": "${version}"`,
    });
  }
}

export interface ParsedFileInfo {
  relativePath: string;
  size: number;
}

export async function discoverFromScan(root: string, parsedFiles: ParsedFileInfo[]): Promise<ExtractionResult> {
  const result: ExtractionResult = { items: [], parseErrors: [], truncated: false };
  const counters = { rules: 0, open: 0 };

  const configFiles = parsedFiles.filter((f) => fileRole(f.relativePath) === "config");

  for (const f of parsedFiles) {
    if (result.items.length >= MAX_ITEM_TOTAL) {
      result.truncated = true;
      break;
    }
    const rel = f.relativePath;
    const role = fileRole(rel);
    if (role === "code" || role === "other" || role === "config" || role === "manifest") {
      if (role === "manifest" && path.basename(rel).toLowerCase() === "package.json") {
        let content: string;
        try {
          content = (await fs.readFile(path.join(root, rel), "utf8")).replace(/^\uFEFF/, "");
        } catch {
          continue;
        }
        parsePackageJson(content, rel, result);
      }
      continue;
    }

    let content: string;
    try {
      content = (await fs.readFile(path.join(root, rel), "utf8")).replace(/^\uFEFF/, "");
    } catch (err) {
      result.parseErrors.push({ sourcePath: rel, message: `read failed: ${(err as Error).message}` });
      continue;
    }

    if (role === "decision-record") {
      parseDecisionRecord(content, rel, result.items);
    } else {
      parseMarkdown(content, role, rel, counters, result.items);
    }
  }

  for (const f of configFiles) {
    const name = path.basename(f.relativePath).toLowerCase();
    let excerpt = "";
    try {
      const raw = await fs.readFile(path.join(root, f.relativePath), "utf8");
      excerpt = raw.split(/\r?\n/)[0].slice(0, 120);
    } catch {
      excerpt = "";
    }
    const base = { sourcePath: f.relativePath, startLine: 1, endLine: 1, excerpt: excerpt || "(config file present)", confidence: "high" as const, classification: "observed-convention" as const };
    if (/^\.?eslintrc|^eslint\.config/.test(name)) {
      result.items.push({ type: "convention", title: "Lint with ESLint", content: "An ESLint configuration is present; linting is part of this project's checks.", ...base });
    } else if (/^\.prettierrc|^prettier\.config/.test(name)) {
      result.items.push({ type: "convention", title: "Format with Prettier", content: "A Prettier configuration is present; formatting is conventional here.", ...base });
    } else if (/^(vitest|jest|playwright)\.config/.test(name)) {
      result.items.push({ type: "verification", title: `Automated test suite (${name.split(".")[0]})`, content: `${name} configures an automated test runner for this project.`, ...base });
    }
  }

  result.truncated = result.truncated || result.items.length >= MAX_ITEM_TOTAL;
  return result;
}
