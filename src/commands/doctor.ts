import * as p from "@clack/prompts";
import pc from "picocolors";
import fs from "node:fs";
import { loadConfig } from "../lib/config.js";
import { ECOSYSTEM_FILES, CONFIG_DIR } from "../lib/paths.js";
import { assembleSystemPrompt } from "../lib/prompt.js";

export async function doctorCommand(): Promise<void> {
  p.intro(pc.bold("achannel doctor") + " — health check");

  let issues = 0;

  // Check config directory
  if (fs.existsSync(CONFIG_DIR)) {
    p.log.success("Config directory exists");
  } else {
    p.log.warning("Config directory not found (~/.achannel/)");
    issues++;
  }

  // Check channels
  const config = loadConfig();
  if (config.channels.length > 0) {
    p.log.success(`${config.channels.length} channel(s) configured`);
    for (const ch of config.channels) {
      const hasToken = ch.token && ch.token.length > 0;
      const hasKey = ch.apiKey && ch.apiKey.length > 0;
      if (hasToken && hasKey) {
        p.log.success(`  ${ch.name}: credentials present`);
      } else {
        p.log.error(`  ${ch.name}: missing credentials`);
        issues++;
      }
    }
  } else {
    p.log.warning("No channels configured");
    issues++;
  }

  // Check ecosystem files
  p.log.info(pc.dim("Ecosystem files:"));
  for (const f of ECOSYSTEM_FILES) {
    if (fs.existsSync(f.path)) {
      p.log.success(`  ${f.name}: found`);
    } else {
      p.log.warning(`  ${f.name}: not found (${f.path})`);
    }
  }

  // Check prompt assembly
  const prompt = assembleSystemPrompt();
  if (prompt.length > 0) {
    p.log.success(`System prompt: ${prompt.length} chars`);
  } else {
    p.log.warning(
      "System prompt is empty — run aman to set up your identity first",
    );
    issues++;
  }

  // Summary
  if (issues === 0) {
    p.outro(pc.green("All checks passed"));
  } else {
    p.outro(pc.yellow(`${issues} issue(s) found`));
  }
}
