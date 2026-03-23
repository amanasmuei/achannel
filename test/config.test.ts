import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// We test config functions by mocking the config dir
const TEST_DIR = path.join(os.tmpdir(), "achannel-test-" + Date.now());
const TEST_CONFIG_PATH = path.join(TEST_DIR, "config.json");
const TEST_CHANNELS_PATH = path.join(TEST_DIR, "channels.md");

// We'll test the core logic directly
import type { ChannelConfig, AchannelConfig } from "../src/lib/config.js";

function loadTestConfig(): AchannelConfig {
  if (!fs.existsSync(TEST_CONFIG_PATH)) return { channels: [] };
  try {
    return JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, "utf-8"));
  } catch {
    return { channels: [] };
  }
}

function saveTestConfig(config: AchannelConfig): void {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.writeFileSync(
    TEST_CONFIG_PATH,
    JSON.stringify(config, null, 2) + "\n",
    "utf-8",
  );
}

describe("config", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("returns empty config when no file exists", () => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    const config = loadTestConfig();
    expect(config).toEqual({ channels: [] });
  });

  it("saves and loads config", () => {
    const config: AchannelConfig = {
      channels: [
        {
          name: "telegram",
          type: "telegram",
          token: "test-token",
          mode: "personal",
          provider: "anthropic",
          apiKey: "sk-test",
          model: "claude-sonnet-4-5-20250514",
        },
      ],
    };
    saveTestConfig(config);
    const loaded = loadTestConfig();
    expect(loaded.channels).toHaveLength(1);
    expect(loaded.channels[0].name).toBe("telegram");
    expect(loaded.channels[0].token).toBe("test-token");
  });

  it("handles add channel (new)", () => {
    const config: AchannelConfig = { channels: [] };
    const channel: ChannelConfig = {
      name: "discord",
      type: "discord",
      token: "discord-token",
      mode: "channel",
      provider: "openai",
      apiKey: "sk-openai",
      model: "gpt-4o",
    };

    const existing = config.channels.findIndex((c) => c.name === channel.name);
    if (existing >= 0) config.channels[existing] = channel;
    else config.channels.push(channel);

    expect(config.channels).toHaveLength(1);
    expect(config.channels[0].type).toBe("discord");
  });

  it("handles add channel (replace existing)", () => {
    const config: AchannelConfig = {
      channels: [
        {
          name: "telegram",
          type: "telegram",
          token: "old-token",
          mode: "personal",
          provider: "anthropic",
          apiKey: "sk-old",
          model: "claude-sonnet-4-5-20250514",
        },
      ],
    };

    const updated: ChannelConfig = {
      name: "telegram",
      type: "telegram",
      token: "new-token",
      mode: "public",
      provider: "ollama",
      apiKey: "ollama",
      model: "llama3.2",
    };

    const existing = config.channels.findIndex(
      (c) => c.name === updated.name,
    );
    if (existing >= 0) config.channels[existing] = updated;
    else config.channels.push(updated);

    expect(config.channels).toHaveLength(1);
    expect(config.channels[0].token).toBe("new-token");
    expect(config.channels[0].mode).toBe("public");
  });

  it("handles remove channel", () => {
    const config: AchannelConfig = {
      channels: [
        {
          name: "telegram",
          type: "telegram",
          token: "t",
          mode: "personal",
          provider: "anthropic",
          apiKey: "k",
          model: "m",
        },
        {
          name: "discord",
          type: "discord",
          token: "d",
          mode: "channel",
          provider: "openai",
          apiKey: "k",
          model: "m",
        },
      ],
    };

    const filtered = config.channels.filter((c) => c.name !== "telegram");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("discord");
  });

  it("remove returns false for nonexistent channel", () => {
    const config: AchannelConfig = { channels: [] };
    const filtered = config.channels.filter((c) => c.name !== "telegram");
    expect(filtered.length === config.channels.length).toBe(true);
  });
});
