import fs from "node:fs";
import { ECOSYSTEM_FILES } from "./paths.js";

export function assembleSystemPrompt(): string {
  const parts: string[] = [];

  for (const f of ECOSYSTEM_FILES) {
    if (fs.existsSync(f.path)) {
      parts.push(fs.readFileSync(f.path, "utf-8").trim());
    }
  }

  return parts.join("\n\n---\n\n");
}
