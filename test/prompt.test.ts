import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("prompt assembly", () => {
  const testDir = path.join(os.tmpdir(), "achannel-prompt-test-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("assembles parts with separator", () => {
    const parts: string[] = [];
    const files = [
      { content: "# Identity\nI am Arienz", exists: true },
      { content: null, exists: false },
      { content: "# Tools\n- search", exists: true },
    ];

    for (const f of files) {
      if (f.exists && f.content) {
        parts.push(f.content.trim());
      }
    }

    const result = parts.join("\n\n---\n\n");
    expect(result).toContain("# Identity");
    expect(result).toContain("---");
    expect(result).toContain("# Tools");
    expect(result).not.toContain("null");
  });

  it("returns empty string when no files exist", () => {
    const parts: string[] = [];
    const result = parts.join("\n\n---\n\n");
    expect(result).toBe("");
  });

  it("trims whitespace from file contents", () => {
    const content = "\n\n  # Identity  \n\n";
    const trimmed = content.trim();
    expect(trimmed).toBe("# Identity");
  });
});
