import { randomUUID } from "crypto";
import * as store from "./store";
import type { DiffFile, Finding, FindingKind, NodeWithEvidence, Project, ReviewRun } from "../../shared/types";

interface ForbiddenPatternRule {
  ruleNodeId: string;
  ruleTitle: string;
  regex: RegExp;
  pathPrefix: string | null;
  evidencePointer: string;
}

const FORBIDDEN_LINE_RE = /^forbidden pattern:\s*(.+?)(?:\s+in\s+(\S+))?\s*$/im;

function extractForbiddenPatterns(nodes: NodeWithEvidence[]): ForbiddenPatternRule[] {
  const rules: ForbiddenPatternRule[] = [];
  for (const { node, evidence } of nodes) {
    if (node.status !== "user-approved") continue;
    if (!["principle", "convention"].includes(node.type)) continue;
    const lines = node.content.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(FORBIDDEN_LINE_RE);
      if (!match) continue;
      let pattern = match[1].trim();
      const delimMatch = pattern.match(/^\/(.+?)\/([a-z]*)$/);
      if (delimMatch) pattern = delimMatch[1];
      try {
        rules.push({
          ruleNodeId: node.id,
          ruleTitle: node.title,
          regex: new RegExp(pattern, "i"),
          pathPrefix: match[2] ? match[2].replace(/\/$/, "") : null,
          evidencePointer: evidencePointer(node, evidence),
        });
      } catch {
        // invalid regex in a user rule: skip it; the pack/UI shows the rule text as-is
      }
    }
  }
  return rules;
}

function evidencePointer(node: NodeWithEvidence["node"], evidence: NodeWithEvidence["evidence"]): string {
  const ev = evidence[0];
  if (!ev) return "user-authored rule (no source evidence)";
  const range = ev.endLine !== ev.startLine ? `${ev.startLine}-${ev.endLine}` : `${ev.startLine}`;
  return `${ev.sourcePath}:${range} (${ev.classification}, confidence ${ev.confidence})`;
}

function isTestPath(p: string): boolean {
  return /\.(test|spec)\.[a-z]+$/i.test(p) || /(^|\/)(tests?|__tests__)\//i.test(p);
}

function isSourcePath(p: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt)$/i.test(p);
}

export interface CheckResult {
  checksRun: string[];
  findings: Finding[];
  applicableRules: {
    ruleNodeId: string;
    title: string;
    appliesTo: string;
    evidencePointer: string;
  }[];
}

export function runChecks(project: Project, files: DiffFile[]): CheckResult {
  const runId = randomUUID();
  const nodes = store.getNodesWithEvidence(project.id);
  const edges = store.getEdges(project.id);
  const findings: Finding[] = [];
  const appliedRules: CheckResult["applicableRules"] = [];

  const approvedRules = nodes.filter(
    (n) => n.node.status === "user-approved" && ["principle", "convention", "procedure"].includes(n.node.type)
  );
  const patterns = extractForbiddenPatterns(nodes);

  const componentNodes = new Map(
    nodes.filter((n) => n.node.type === "component").map((n) => [n.node.title.replace(/^Component: /, "").replace(/\/$/, ""), n])
  );

  const statusEvidencePaths = new Set(
    nodes
      .filter((n) => n.node.type === "status-question" && n.evidence.length > 0)
      .map((n) => n.evidence[0].sourcePath)
  );

  const testRequiringRules = approvedRules.filter(
    (n) => /\btest/i.test(n.node.content) && /\b(must|always|every|required)\b/i.test(n.node.content)
  );

  function addFinding(
    kind: FindingKind,
    changedPath: string,
    changedLines: [number, number] | null,
    severity: Finding["severity"],
    certainty: Finding["certainty"],
    explanation: string,
    rule: NodeWithEvidence | null,
    changedEvidence: string,
    recommendation: string,
    blocking: boolean
  ): void {
    findings.push({
      id: randomUUID(),
      reviewRunId: runId,
      ruleNodeId: rule?.node.id ?? null,
      ruleTitle: rule?.node.title ?? null,
      changedPath,
      changedLines,
      kind,
      severity,
      certainty,
      explanation,
      ruleEvidence: rule ? evidencePointer(rule.node, rule.evidence) : null,
      changedEvidence,
      recommendation,
      blocking,
      disposition: "open",
    });
  }

  const changedCodeFiles = files.filter((f) => isSourcePath(f.path) && !isTestPath(f.path));
  const changedTestFiles = files.filter((f) => isTestPath(f.path));

  for (const file of files) {
    const topDir = file.path.includes("/") ? file.path.split("/")[0] : null;

    for (const rule of approvedRules) {
      const governed = edges.find(
        (e) => e.relation === "governs" && e.sourceNodeId === rule.node.id && componentNodes.get(topDir ?? "")?.node.id === e.targetNodeId
      );
      const evidenceTopDir = rule.evidence[0]?.sourcePath.split("/")[0] ?? null;
      if (governed || (topDir && evidenceTopDir === topDir)) {
        if (!appliedRules.some((a) => a.ruleNodeId === rule.node.id && a.appliesTo === file.path)) {
          appliedRules.push({
            ruleNodeId: rule.node.id,
            title: rule.node.title,
            appliesTo: file.path,
            evidencePointer: evidencePointer(rule.node, rule.evidence),
          });
        }
      }
    }

    if (statusEvidencePaths.has(file.path)) {
      addFinding(
        "status-evidence-changed",
        file.path,
        null,
        "info",
        "needs-human-review",
        "This diff changes a file that is recorded evidence for a project status claim. Related status claims may now be stale; review them in the Maintenance view.",
        null,
        `${file.path} changed in this diff (was recorded as status evidence)`,
        "Refresh the scan and review the affected status claims; do not treat the old status as current.",
        false
      );
    }

    for (const hunk of file.hunks) {
      for (const change of hunk.changes) {
        if (change.type === "normal") continue;
        const lineText = change.content.replace(/^[+-]/, "");
        for (const pattern of patterns) {
          if (pattern.pathPrefix && !file.path.startsWith(pattern.pathPrefix)) continue;
          if (!pattern.regex.test(lineText)) continue;
          addFinding(
            "prohibited-pattern",
            file.path,
            [change.lineNumber ?? hunk.newStart, change.lineNumber ?? hunk.newStart],
            "high",
            "deterministic",
            `Line matches a forbidden pattern encoded in the approved rule "${pattern.ruleTitle}"${pattern.pathPrefix ? ` (scoped to ${pattern.pathPrefix}/)` : ""}. This is a mechanical match, not an interpretation.`,
            nodes.find((n) => n.node.id === pattern.ruleNodeId) ?? null,
            `${file.path}:${change.lineNumber ?? hunk.newStart} — ${lineText.trim().slice(0, 160)}`,
            `Review the line against the rule. If the pattern is correct, refactor the change to comply; if the rule is wrong, update it in Principles and regenerate the instruction pack.`,
            true
          );
        }
      }
    }
  }

  if (testRequiringRules.length > 0 && changedCodeFiles.length > 0 && changedTestFiles.length === 0) {
    const rule = testRequiringRules[0];
    addFinding(
      "missing-verification",
      changedCodeFiles.map((f) => f.path).join(", ").slice(0, 200),
      null,
      "medium",
      "strong-evidence",
      `An approved rule requires tests with changes ("${rule.node.title.slice(0, 120)}"), but this diff changes source files without any test changes. Whether the rule applies to this specific change needs human review.`,
      rule,
      `${changedCodeFiles.length} changed source file(s), 0 changed test files`,
      `Add or update tests for the changed files, or record why this change does not require tests.`,
      false
    );
  }

  const checksRun = [
    `prohibited-pattern checks (${patterns.length} user-encoded pattern${patterns.length === 1 ? "" : "s"})`,
    `required-test presence (${testRequiringRules.length} test-requiring approved rule${testRequiringRules.length === 1 ? "" : "s"})`,
    `status-evidence watch (${statusEvidencePaths.size} tracked path${statusEvidencePaths.size === 1 ? "" : "s"})`,
  ];

  return { checksRun, findings, applicableRules: appliedRules };
}
