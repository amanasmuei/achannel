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

/**
 * Streaming chat with SSE-compatible callback.
 * Streams text chunks and tool status events.
 */
export async function streamChatWithTools(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Message[],
  mcpManager: McpManager | null,
  onChunk: (event: string, data: string) => void,
  ollamaUrl?: string,
): Promise<string> {
  const tools = mcpManager?.getTools() || [];

  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey });
    const currentMessages: Anthropic.Messages.MessageParam[] = messages.map(
      (m) => ({ role: m.role, content: m.content }),
    );
    let fullText = "";

    const createParams: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: currentMessages,
      stream: true,
    };

    if (tools.length > 0) {
      createParams.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Messages.Tool["input_schema"],
      }));
    }

    const toolUseBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
    let currentBlockType: string | null = null;

    const stream = await client.messages.create(
      createParams as Anthropic.Messages.MessageCreateParamsStreaming,
    );

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "text") {
          currentBlockType = "text";
        } else if (event.content_block.type === "tool_use") {
          currentBlockType = "tool_use";
          toolUseBlocks.push({
            id: event.content_block.id,
            name: event.content_block.name,
            inputJson: "",
          });
          onChunk("tool", JSON.stringify({ name: event.content_block.name, status: "running" }));
        }
      } else if (event.type === "content_block_delta") {
        if (currentBlockType === "text" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          onChunk("text", event.delta.text);
        } else if (currentBlockType === "tool_use" && event.delta.type === "input_json_delta") {
          const last = toolUseBlocks[toolUseBlocks.length - 1];
          if (last) last.inputJson += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        currentBlockType = null;
      }
    }

    // Execute tools if requested
    if (toolUseBlocks.length > 0 && mcpManager) {
      const assistantContent: Anthropic.Messages.ContentBlockParam[] = [];
      if (fullText) assistantContent.push({ type: "text", text: fullText });
      for (const tu of toolUseBlocks) {
        assistantContent.push({
          type: "tool_use",
          id: tu.id,
          name: tu.name,
          input: JSON.parse(tu.inputJson || "{}"),
        });
      }
      currentMessages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const tu of toolUseBlocks) {
        const result = await mcpManager.callTool(tu.name, JSON.parse(tu.inputJson || "{}"));
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
        onChunk("tool", JSON.stringify({ name: tu.name, status: "done" }));
      }
      currentMessages.push({ role: "user", content: toolResults });

      // Follow-up after tools (non-streaming for simplicity)
      const followUp = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: currentMessages,
      });
      const followUpText = followUp.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (followUpText) {
        onChunk("text", followUpText);
        fullText += followUpText;
      }
    }

    return fullText;
  }

  // OpenAI / Ollama streaming
  const clientOpts: ConstructorParameters<typeof OpenAI>[0] = { apiKey };
  if (provider === "ollama") {
    clientOpts.baseURL = ollamaUrl || "http://localhost:11434/v1";
    clientOpts.apiKey = "ollama";
  }
  const client = new OpenAI(clientOpts);

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
  });

  let fullText = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) {
      fullText += text;
      onChunk("text", text);
    }
  }

  return fullText;
}
