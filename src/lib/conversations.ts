import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR } from "./paths.js";

const CONV_DIR = path.join(CONFIG_DIR, "conversations");

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  channelType: string;
  chatId: string;
  messages: Message[];
  updatedAt: string;
}

export function loadConversation(
  channelType: string,
  chatId: string,
): Message[] {
  const filePath = path.join(CONV_DIR, `${channelType}-${chatId}.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const conv: Conversation = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return conv.messages;
  } catch {
    return [];
  }
}

export function saveConversation(
  channelType: string,
  chatId: string,
  messages: Message[],
): void {
  fs.mkdirSync(CONV_DIR, { recursive: true });
  const conv: Conversation = {
    channelType,
    chatId: String(chatId),
    messages: messages.slice(-50), // keep last 50 messages
    updatedAt: new Date().toISOString(),
  };
  const filePath = path.join(CONV_DIR, `${channelType}-${chatId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(conv, null, 2) + "\n", "utf-8");
}

export function clearConversation(
  channelType: string,
  chatId: string,
): void {
  const filePath = path.join(CONV_DIR, `${channelType}-${chatId}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
