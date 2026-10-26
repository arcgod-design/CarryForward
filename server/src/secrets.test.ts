import { describe, it, expect } from "vitest";
import { isSecretFileName, findSecrets, redactSecrets } from "./secrets";

describe("isSecretFileName", () => {
  it.each([
    [".env", true],
    [".env.production", true],
    [".env.example", false],
    ["id_rsa", true],
    ["server.pem", true],
    [".npmrc", true],
    ["secrets.md", true],
    ["README.md", false],
    ["index.ts", false],
  ])("%s -> %s", (name, expected) => {
    expect(isSecretFileName(name)).toBe(expected);
  });
});

describe("findSecrets / redactSecrets", () => {
  it("detects common credential formats", () => {
    const text = [
      "aws key AKIAABCDEFGHIJKLMNOP",
      "github ghp_1234567890abcdefghijklmnop",
      "key sk-abcdefghijklmnopqrstuvwxyz123456",
      "-----BEGIN RSA PRIVATE KEY-----",
    ].join("\n");
    const found = findSecrets(text).map((h) => h.name);
    expect(found).toContain("AWS access key");
    expect(found).toContain("GitHub token");
    expect(found).toContain("API key (sk-)");
    expect(found).toContain("private key block");
  });

  it("redacts values and keeps surrounding text", () => {
    const { redacted, found } = redactSecrets("token=supersecretvalue123 visible");
    expect(redacted).not.toContain("supersecretvalue123");
    expect(redacted).toContain("[REDACTED:credential assignment]");
    expect(redacted).toContain("visible");
    expect(found.length).toBeGreaterThan(0);
  });

  it("leaves clean text untouched", () => {
    const { redacted, found } = redactSecrets("just normal documentation text");
    expect(redacted).toBe("just normal documentation text");
    expect(found).toEqual([]);
  });
});
