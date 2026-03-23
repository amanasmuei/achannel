import fs from "node:fs";
import { CONFIG_DIR, CONFIG_PATH, CHANNELS_PATH } from "./paths.js";

export interface ChannelConfig {
  name: string;
  type: "telegram" | "discord" | "whatsapp" | "webhook";
  token: string;
  mode: "personal" | "channel" | "public";
  ownerChatId?: string;
  provider: "anthropic" | "openai" | "ollama";
  apiKey: string;
  model: string;
  ollamaUrl?: string;
}

export interface AchannelConfig {
  channels: ChannelConfig[];
}

export function loadConfig(): AchannelConfig {
  if (!fs.existsSync(CONFIG_PATH)) return { channels: [] };
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return { channels: [] };
  }
}

export function saveConfig(config: AchannelConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify(config, null, 2) + "\n",
    "utf-8",
  );
  generateChannelsMd(config);
}

export function addChannel(channel: ChannelConfig): void {
  const config = loadConfig();
  const existing = config.channels.findIndex((c) => c.name === channel.name);
  if (existing >= 0) config.channels[existing] = channel;
  else config.channels.push(channel);
  saveConfig(config);
}

export function removeChannel(name: string): boolean {
  const config = loadConfig();
  const filtered = config.channels.filter((c) => c.name !== name);
  if (filtered.length === config.channels.length) return false;
  config.channels = filtered;
  saveConfig(config);
  return true;
}

function generateChannelsMd(config: AchannelConfig): void {
  const lines = ["# My AI Channels", ""];
  for (const ch of config.channels) {
    lines.push(`## ${ch.name}`);
    lines.push(`- Type: ${ch.type}`);
    lines.push(`- Mode: ${ch.mode}`);
    lines.push(`- Model: ${ch.model}`);
    lines.push(`- Provider: ${ch.provider}`);
    lines.push("");
  }
  fs.writeFileSync(CHANNELS_PATH, lines.join("\n"), "utf-8");
}
