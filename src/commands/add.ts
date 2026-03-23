import * as p from "@clack/prompts";
import pc from "picocolors";
import { addChannel, type ChannelConfig } from "../lib/config.js";

export async function addCommand(channelType: string): Promise<void> {
  p.intro(pc.bold("achannel add") + " — setting up " + pc.cyan(channelType));

  const validTypes = ["telegram", "discord", "whatsapp", "webhook"];
  if (!validTypes.includes(channelType)) {
    p.log.error(
      `Unknown channel: ${channelType}. Choose: ${validTypes.join(", ")}`,
    );
    return;
  }

  // Get token/credentials
  let tokenMessage = "Bot token";
  if (channelType === "webhook") tokenMessage = "Port number (default: 3000)";
  if (channelType === "whatsapp") tokenMessage = "Twilio Auth Token";

  const token = (await p.text({
    message: tokenMessage,
    validate: (v) => (v.length === 0 ? "Required" : undefined),
  })) as string;
  if (p.isCancel(token)) return;

  // Mode
  const mode = (await p.select({
    message: "Who can use this?",
    options: [
      {
        value: "personal",
        label: "Only me",
        hint: "responds only to your messages",
      },
      {
        value: "channel",
        label: "Specific channel/group",
        hint: "responds in one channel",
      },
      { value: "public", label: "Anyone", hint: "responds to all messages" },
    ],
    initialValue: "personal",
  })) as "personal" | "channel" | "public";
  if (p.isCancel(mode)) return;

  // LLM provider
  const provider = (await p.select({
    message: "LLM provider",
    options: [
      { value: "anthropic", label: "Claude (Anthropic)", hint: "recommended" },
      { value: "openai", label: "GPT (OpenAI)" },
      { value: "ollama", label: "Ollama (local)", hint: "free, runs offline" },
    ],
    initialValue: "anthropic",
  })) as "anthropic" | "openai" | "ollama";
  if (p.isCancel(provider)) return;

  let apiKey = "";
  let model = "";
  let ollamaUrl: string | undefined;

  if (provider === "ollama") {
    model = (await p.text({
      message: "Ollama model",
      placeholder: "llama3.2",
      defaultValue: "llama3.2",
    })) as string;
    if (p.isCancel(model)) return;

    ollamaUrl = (await p.text({
      message: "Ollama URL",
      placeholder: "http://localhost:11434/v1",
      defaultValue: "http://localhost:11434/v1",
    })) as string;
    if (p.isCancel(ollamaUrl)) return;

    apiKey = "ollama";
  } else {
    apiKey = (await p.text({
      message: "API key",
      validate: (v) => (v.length === 0 ? "Required" : undefined),
    })) as string;
    if (p.isCancel(apiKey)) return;

    model =
      provider === "anthropic" ? "claude-sonnet-4-5-20250514" : "gpt-4o";
  }

  const channelConfig: ChannelConfig = {
    name: channelType,
    type: channelType as ChannelConfig["type"],
    token,
    mode,
    provider,
    apiKey,
    model,
    ollamaUrl,
  };

  addChannel(channelConfig);
  p.log.success(`${channelType} channel configured`);
  p.log.info(`Run ${pc.bold("achannel serve")} to start`);
  p.outro("Done.");
}
