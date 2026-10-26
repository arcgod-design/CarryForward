interface SecretPattern {
  name: string;
  re: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token", re: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "API key (sk-)", re: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "bearer token", re: /bearer\s+[A-Za-z0-9._-]{20,}/i },
  {
    name: "credential assignment",
    re: /(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["']?[^\s"']{8,}/i,
  },
];

const SECRET_NAME_RE = /\.(pem|key|p12|pfx|keystore)$/i;
const SECRET_NAMES = new Set([".env", ".netrc", ".npmrc", "credentials", "secrets"]);
const SECRET_NAME_PREFIXES = ["id_rsa", "secret", "credential"];

export function isSecretFileName(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === ".env.example") return false;
  if (lower.startsWith(".env")) return true;
  if (SECRET_NAMES.has(lower)) return true;
  if (SECRET_NAME_PREFIXES.some((p) => lower.startsWith(p))) return true;
  return SECRET_NAME_RE.test(lower);
}

export function findSecrets(text: string): { name: string; index: number; length: number }[] {
  const hits: { name: string; index: number; length: number }[] = [];
  for (const p of SECRET_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ name: p.name, index: m.index, length: m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export function redactSecrets(text: string): { redacted: string; found: string[] } {
  const hits = findSecrets(text);
  if (hits.length === 0) return { redacted: text, found: [] };
  let out = "";
  let cursor = 0;
  const found: string[] = [];
  for (const h of hits) {
    if (h.index < cursor) continue;
    out += text.slice(cursor, h.index) + `[REDACTED:${h.name}]`;
    cursor = h.index + h.length;
    if (!found.includes(h.name)) found.push(h.name);
  }
  out += text.slice(cursor);
  return { redacted: out, found };
}
