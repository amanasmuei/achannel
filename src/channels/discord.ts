import { Client, GatewayIntentBits } from "discord.js";
import type { ChannelConfig } from "../lib/config.js";
import { assembleSystemPrompt } from "../lib/prompt.js";
import { createLLMClient } from "../lib/llm.js";
import {
  loadConversation,
  saveConversation,
} from "../lib/conversations.js";

export function startDiscord(config: ChannelConfig): void {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const systemPrompt = assembleSystemPrompt();
  const llm = createLLMClient(
    config.provider,
    config.apiKey,
    config.model,
    config.ollamaUrl,
  );

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // Only respond when mentioned or in DMs
    const isMentioned = message.mentions.has(client.user!);
    const isDM = !message.guild;
    if (!isMentioned && !isDM) return;

    const text = message.content.replace(/<@!?\d+>/g, "").trim();
    if (!text) return;

    const channelId = message.channel.id;

    // Load conversation from disk
    const messages = loadConversation("discord", channelId);

    messages.push({ role: "user", content: text });
    const trimmed = messages.slice(-20);

    try {
      await message.channel.sendTyping();
      const response = await llm.chat(systemPrompt, trimmed);
      trimmed.push({ role: "assistant", content: response });

      // Persist to disk
      saveConversation("discord", channelId, trimmed);

      // Discord has 2000 char limit
      if (response.length > 1900) {
        const chunks = response.match(/.{1,1900}/gs) || [response];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(response);
      }
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Unknown error";
      await message.reply(`Error: ${errMsg}`);
    }
  });

  client.login(config.token);
  console.log(`  Discord bot active`);
}
