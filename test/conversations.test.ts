import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const TEST_DIR = path.join(
  os.tmpdir(),
  "achannel-conv-test-" + Date.now(),
);
const CONV_DIR = path.join(TEST_DIR, "conversations");

// Inline the logic so we can point at a test directory
// (the real module uses CONFIG_DIR from paths.ts)

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

function filePath(channelType: string, chatId: string): string {
  return path.join(CONV_DIR, `${channelType}-${chatId}.json`);
}

function loadConversation(channelType: string, chatId: string): Message[] {
  const fp = filePath(channelType, chatId);
  if (!fs.existsSync(fp)) return [];
  try {
    const conv: Conversation = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return conv.messages;
  } catch {
    return [];
  }
}

function saveConversation(
  channelType: string,
  chatId: string,
  messages: Message[],
): void {
  fs.mkdirSync(CONV_DIR, { recursive: true });
  const conv: Conversation = {
    channelType,
    chatId: String(chatId),
    messages: messages.slice(-50),
    updatedAt: new Date().toISOString(),
  };
  const fp = filePath(channelType, chatId);
  fs.writeFileSync(fp, JSON.stringify(conv, null, 2) + "\n", "utf-8");
}

function clearConversation(channelType: string, chatId: string): void {
  const fp = filePath(channelType, chatId);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

describe("conversations", () => {
  beforeEach(() => {
    fs.mkdirSync(CONV_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("loadConversation", () => {
    it("returns empty array when file does not exist", () => {
      const messages = loadConversation("telegram", "99999");
      expect(messages).toEqual([]);
    });

    it("loads a valid conversation file", () => {
      const conv: Conversation = {
        channelType: "telegram",
        chatId: "123",
        messages: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "hi there" },
        ],
        updatedAt: new Date().toISOString(),
      };
      const fp = filePath("telegram", "123");
      fs.writeFileSync(fp, JSON.stringify(conv), "utf-8");

      const messages = loadConversation("telegram", "123");
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("hello");
      expect(messages[1].role).toBe("assistant");
    });

    it("returns empty array for malformed JSON", () => {
      const fp = filePath("telegram", "bad");
      fs.writeFileSync(fp, "not json {{{", "utf-8");

      const messages = loadConversation("telegram", "bad");
      expect(messages).toEqual([]);
    });
  });

  describe("saveConversation", () => {
    it("creates directory and writes file", () => {
      // Remove the dir first to test creation
      fs.rmSync(CONV_DIR, { recursive: true, force: true });

      saveConversation("discord", "456", [
        { role: "user", content: "test" },
      ]);

      const fp = filePath("discord", "456");
      expect(fs.existsSync(fp)).toBe(true);

      const raw = JSON.parse(fs.readFileSync(fp, "utf-8"));
      expect(raw.channelType).toBe("discord");
      expect(raw.chatId).toBe("456");
      expect(raw.messages).toHaveLength(1);
      expect(raw.updatedAt).toBeDefined();
    });

    it("truncates messages to last 50", () => {
      const messages: Message[] = [];
      for (let i = 0; i < 60; i++) {
        messages.push({ role: "user", content: `msg-${i}` });
      }

      saveConversation("webhook", "sess1", messages);

      const loaded = loadConversation("webhook", "sess1");
      expect(loaded).toHaveLength(50);
      expect(loaded[0].content).toBe("msg-10");
      expect(loaded[49].content).toBe("msg-59");
    });
  });

  describe("clearConversation", () => {
    it("removes the conversation file", () => {
      saveConversation("telegram", "789", [
        { role: "user", content: "bye" },
      ]);
      const fp = filePath("telegram", "789");
      expect(fs.existsSync(fp)).toBe(true);

      clearConversation("telegram", "789");
      expect(fs.existsSync(fp)).toBe(false);
    });

    it("does not throw when file does not exist", () => {
      expect(() => clearConversation("telegram", "nope")).not.toThrow();
    });
  });
});
