import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadConfig } from "../lib/config.js";

export async function listCommand(): Promise<void> {
  const config = loadConfig();

  if (config.channels.length === 0) {
    p.intro(pc.bold("achannel"));
    p.log.info("No channels configured.");
    p.log.info(
      `Run ${pc.bold("achannel add telegram")} to set up your first channel.`,
    );
    p.outro("");
    return;
  }

  p.intro(
    pc.bold("achannel") + " — " + config.channels.length + " channel(s)",
  );

  for (const ch of config.channels) {
    p.log.info(
      `${pc.bold(ch.name)} (${ch.type}) — ${ch.mode} mode, ${ch.model} via ${ch.provider}`,
    );
  }

  p.outro("");
}
