import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadConfig } from "../lib/config.js";
import { assembleSystemPrompt } from "../lib/prompt.js";

export async function serveCommand(): Promise<void> {
  const config = loadConfig();

  if (config.channels.length === 0) {
    p.intro(pc.bold("achannel serve"));
    p.log.error(
      "No channels configured. Run " +
        pc.bold("achannel add telegram") +
        " first.",
    );
    return;
  }

  const prompt = assembleSystemPrompt();
  const hasEcosystem = prompt.length > 0;

  p.intro(
    pc.bold("achannel") +
      " — serving " +
      config.channels.length +
      " channel(s)",
  );

  if (hasEcosystem) {
    p.log.success("Ecosystem loaded");
  } else {
    p.log.warning("No ecosystem configured — AI will have no identity");
  }

  for (const channel of config.channels) {
    try {
      if (channel.type === "telegram") {
        const { startTelegram } = await import("../channels/telegram.js");
        startTelegram(channel);
      } else if (channel.type === "discord") {
        const { startDiscord } = await import("../channels/discord.js");
        startDiscord(channel);
      } else if (channel.type === "webhook") {
        const { startWebhook } = await import("../channels/webhook.js");
        startWebhook(channel);
      }
      p.log.success(
        `${channel.type}: active (${channel.mode} mode, ${channel.model})`,
      );
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Unknown error";
      p.log.error(`${channel.type}: failed — ${errMsg}`);
    }
  }

  p.log.info(pc.dim("Press Ctrl+C to stop"));

  // Keep process alive
  await new Promise(() => {});
}
