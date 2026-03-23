import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { McpManager } from "../mcp/client.js";

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

/**
 * Chat with MCP tool execution support.
 * For Anthropic provider with tools: runs the full tool loop (call AI -> execute tools -> feed results -> repeat).
 * For other providers or when no tools available: falls back to simple chat.
 */
export async function chatWithTools(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Message[],
  mcpManager: McpManager | null,
  ollamaUrl?: string,
): Promise<string> {
  const tools = mcpManager?.getTools() || [];

  // Anthropic with tools: run the tool loop
  if (provider === "anthropic" && tools.length > 0) {
    const client = new Anthropic({ apiKey });
    // Build Anthropic-format messages from our simple Message[]
    let currentMessages: Anthropic.Messages.MessageParam[] = messages.map(
      (m) => ({
        role: m.role,
        content: m.content,
      }),
    );

    while (true) {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: currentMessages,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Messages.Tool["input_schema"],
        })),
      });

      // Check for tool use
      const toolUses = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );
      const textParts = response.content
        .filter(
          (b): b is Anthropic.Messages.TextBlock => b.type === "text",
        )
        .map((b) => b.text);

      if (toolUses.length === 0) {
        return textParts.join("");
      }

      // Add assistant response with tool calls
      currentMessages.push({ role: "assistant", content: response.content });

      // Execute each tool and collect results
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const result = await mcpManager!.callTool(
          tu.name,
          tu.input as Record<string, unknown>,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      }

      currentMessages.push({ role: "user", content: toolResults });
    }
  }

  // Fallback: simple chat without tools
  const llm = createLLMClient(provider, apiKey, model, ollamaUrl);
  return llm.chat(systemPrompt, messages);
}
