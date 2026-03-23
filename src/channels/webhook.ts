import http from "node:http";
import type { ChannelConfig } from "../lib/config.js";
import { assembleSystemPrompt } from "../lib/prompt.js";
import { createLLMClient } from "../lib/llm.js";
import {
  loadConversation,
  saveConversation,
  clearConversation,
} from "../lib/conversations.js";

export function startWebhook(config: ChannelConfig): void {
  const systemPrompt = assembleSystemPrompt();
  const llm = createLLMClient(
    config.provider,
    config.apiKey,
    config.model,
    config.ollamaUrl,
  );

  const port = parseInt(config.token) || 3000;

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // GET /status
    if (req.method === "GET" && req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          provider: config.provider,
          model: config.model,
        }),
      );
      return;
    }

    // POST /chat
    if (req.method === "POST" && req.url === "/chat") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const { message, messages, session_id } = JSON.parse(body);

          let chatMessages: Array<{
            role: "user" | "assistant";
            content: string;
          }>;

          if (session_id) {
            // Persistent session: load from disk, append new message
            chatMessages = loadConversation("webhook", session_id);
            if (message) {
              chatMessages.push({ role: "user", content: message });
            }
          } else {
            // Stateless: use provided messages or single message
            chatMessages = messages || [
              { role: "user" as const, content: message },
            ];
          }

          const response = await llm.chat(systemPrompt, chatMessages);

          if (session_id) {
            chatMessages.push({ role: "assistant", content: response });
            saveConversation("webhook", session_id, chatMessages);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ response, session_id }));
        } catch (error) {
          const errMsg =
            error instanceof Error ? error.message : "Unknown error";
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: errMsg }));
        }
      });
      return;
    }

    // DELETE /chat — clear a session
    if (req.method === "DELETE" && req.url === "/chat") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const { session_id } = JSON.parse(body);
          if (session_id) {
            clearConversation("webhook", session_id);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ cleared: true }));
        } catch (error) {
          const errMsg =
            error instanceof Error ? error.message : "Unknown error";
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: errMsg }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    console.log(`  Webhook server on port ${port}`);
  });
}
