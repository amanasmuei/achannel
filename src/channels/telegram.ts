import TelegramBot from "node-telegram-bot-api";
import type { ChannelConfig } from "../lib/config.js";
import { assembleSystemPrompt } from "../lib/prompt.js";
import { createLLMClient } from "../lib/llm.js";

interface ConversationState {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export function startTelegram(config: ChannelConfig): void {
  const bot = new TelegramBot(config.token, { polling: true });
  const systemPrompt = assembleSystemPrompt();
  const llm = createLLMClient(
    config.provider,
    config.apiKey,
    config.model,
    config.ollamaUrl,
  );
  const conversations = new Map<number, ConversationState>();

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;

    // Personal mode: only respond to owner
    if (
      config.mode === "personal" &&
      config.ownerChatId &&
      String(chatId) !== config.ownerChatId
    ) {
      return;
    }

    // Get or create conversation state
    if (!conversations.has(chatId)) {
      conversations.set(chatId, { messages: [] });
    }
    const state = conversations.get(chatId)!;

    // Handle /clear command
    if (text === "/clear") {
      state.messages = [];
      bot.sendMessage(chatId, "Conversation cleared.");
      return;
    }

    // Handle /start command
    if (text === "/start") {
      bot.sendMessage(
        chatId,
        "Hello! I'm your AI companion powered by aman. Send me a message to start chatting.",
      );
      if (config.mode === "personal" && !config.ownerChatId) {
        config.ownerChatId = String(chatId);
      }
      return;
    }

    // Add user message
    state.messages.push({ role: "user", content: text });

    // Keep last 20 messages to avoid context overflow
    if (state.messages.length > 20) {
      state.messages = state.messages.slice(-20);
    }

    try {
      bot.sendChatAction(chatId, "typing");

      const response = await llm.chat(systemPrompt, state.messages);
      state.messages.push({ role: "assistant", content: response });

      // Telegram has a 4096 char limit per message
      if (response.length > 4000) {
        const chunks = response.match(/.{1,4000}/gs) || [response];
        for (const chunk of chunks) {
          await bot.sendMessage(chatId, chunk);
        }
      } else {
        await bot.sendMessage(chatId, response);
      }
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Unknown error";
      bot.sendMessage(chatId, `Error: ${errMsg}`);
    }
  });

  console.log(`  Telegram bot active (${config.mode} mode)`);
}
