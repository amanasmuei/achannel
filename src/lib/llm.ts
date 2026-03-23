import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface LLMClient {
  chat(systemPrompt: string, messages: Message[]): Promise<string>;
}

export function createLLMClient(
  provider: string,
  apiKey: string,
  model: string,
  ollamaUrl?: string,
): LLMClient {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey });
    return {
      async chat(systemPrompt, messages) {
        const response = await client.messages.create({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });
        return response.content[0].type === "text"
          ? response.content[0].text
          : "";
      },
    };
  }

  if (provider === "ollama") {
    const client = new OpenAI({
      baseURL: ollamaUrl || "http://localhost:11434/v1",
      apiKey: "ollama",
    });
    return {
      async chat(systemPrompt, messages) {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        });
        return response.choices[0]?.message?.content || "";
      },
    };
  }

  // Default: OpenAI
  const client = new OpenAI({ apiKey });
  return {
    async chat(systemPrompt, messages) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      });
      return response.choices[0]?.message?.content || "";
    },
  };
}
