import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import type { ChannelConfig } from "../lib/config.js";
import { assembleSystemPrompt } from "../lib/prompt.js";
import { chatWithTools, streamChatWithTools } from "../lib/llm.js";
import {
  loadConversation,
  saveConversation,
  clearConversation,
} from "../lib/conversations.js";
import type { McpManager } from "../mcp/client.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function getPublicDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  let dir = path.dirname(thisFile);
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, "public");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return path.join(process.cwd(), "public");
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, publicDir: string): boolean {
  let filePath = req.url === "/" ? "/index.html" : req.url || "/index.html";
  filePath = filePath.split("?")[0];

  const resolved = path.resolve(publicDir, "." + filePath);
  if (!resolved.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return false;

  const ext = path.extname(resolved);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  res.end(fs.readFileSync(resolved));
  return true;
}

function parseQuery(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const idx = url.indexOf("?");
  if (idx < 0) return params;
  for (const pair of url.slice(idx + 1).split("&")) {
    const [k, v] = pair.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  }
  return params;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function startWebhook(
  config: ChannelConfig,
  mcpManager: McpManager | null,
): void {
  const systemPrompt = assembleSystemPrompt();
  const port = parseInt(config.token) || 3000;
  const publicDir = getPublicDir();
  const home = os.homedir();

  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

    const url = req.url || "/";
    const pathname = url.split("?")[0];

    // ── SSE Streaming Chat ──
    if (req.method === "GET" && pathname === "/chat/stream") {
      const params = parseQuery(url);
      const message = params.message;
      const sessionId = params.session_id || `web-${Date.now()}`;

      if (!message) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "message parameter required" }));
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const chatMessages = loadConversation("webhook", sessionId);
      chatMessages.push({ role: "user", content: message });

      try {
        const response = await streamChatWithTools(
          config.provider, config.apiKey, config.model,
          systemPrompt, chatMessages, mcpManager,
          (event, data) => { res.write(`event: ${event}\ndata: ${data}\n\n`); },
          config.ollamaUrl,
        );

        chatMessages.push({ role: "assistant", content: response });
        saveConversation("webhook", sessionId, chatMessages);
        res.write(`event: done\ndata: ${JSON.stringify({ session_id: sessionId })}\n\n`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        res.write(`event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`);
      }

      res.end();
      return;
    }

    // ── API: Status ──
    if (req.method === "GET" && pathname === "/api/status") {
      const layers: Record<string, boolean> = {};
      for (const f of [
        { name: "identity", p: path.join(home, ".acore", "core.md") },
        { name: "rules", p: path.join(home, ".arules", "rules.md") },
        { name: "workflows", p: path.join(home, ".aflow", "flow.md") },
        { name: "tools", p: path.join(home, ".akit", "kit.md") },
        { name: "skills", p: path.join(home, ".askill", "skills.md") },
        { name: "eval", p: path.join(home, ".aeval", "eval.md") },
      ]) { layers[f.name] = fs.existsSync(f.p); }

      // Get AI name
      let aiName = "Aman";
      const corePath = path.join(home, ".acore", "core.md");
      if (fs.existsSync(corePath)) {
        const match = fs.readFileSync(corePath, "utf-8").match(/^# (.+)/m);
        if (match) aiName = match[1].trim();
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", aiName, provider: config.provider, model: config.model, layers }));
      return;
    }

    // ── API: Plans ──
    if (req.method === "GET" && pathname === "/api/plans") {
      const dirs = [path.join(process.cwd(), ".acore", "plans"), path.join(home, ".acore", "plans")];
      const dir = dirs.find((d) => fs.existsSync(d));
      const plans: Array<{ name: string; content: string }> = [];
      if (dir) {
        for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
          plans.push({ name: file.replace(".md", ""), content: fs.readFileSync(path.join(dir, file), "utf-8") });
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(plans));
      return;
    }

    // ── API: Profiles ──
    if (req.method === "GET" && pathname === "/api/profiles") {
      const profilesDir = path.join(home, ".acore", "profiles");
      const profiles: Array<{ name: string; aiName: string; personality: string }> = [];
      if (fs.existsSync(profilesDir)) {
        for (const entry of fs.readdirSync(profilesDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const cp = path.join(profilesDir, entry.name, "core.md");
          if (!fs.existsSync(cp)) continue;
          const c = fs.readFileSync(cp, "utf-8");
          profiles.push({
            name: entry.name,
            aiName: c.match(/^# (.+)/m)?.[1]?.trim() || entry.name,
            personality: c.match(/- Personality:\s*(.+)/)?.[1]?.trim() || "",
          });
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(profiles));
      return;
    }

    // ── API: Teams ──
    if (req.method === "GET" && pathname === "/api/teams") {
      const teamsDir = path.join(home, ".acore", "teams");
      const teams: unknown[] = [];
      if (fs.existsSync(teamsDir)) {
        for (const file of fs.readdirSync(teamsDir).filter((f) => f.endsWith(".json"))) {
          try { teams.push(JSON.parse(fs.readFileSync(path.join(teamsDir, file), "utf-8"))); } catch { /* skip */ }
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(teams));
      return;
    }

    // ── API: Memory Search ──
    if (req.method === "GET" && pathname === "/api/memory") {
      const q = parseQuery(url).q || "";
      if (!q || !mcpManager) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("[]");
        return;
      }
      try {
        const result = await mcpManager.callTool("memory_recall", { query: q, limit: 10 });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(result);
      } catch {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("[]");
      }
      return;
    }

    // ── Existing: GET /status ──
    if (req.method === "GET" && pathname === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", provider: config.provider, model: config.model }));
      return;
    }

    // ── Existing: POST /chat ──
    if (req.method === "POST" && pathname === "/chat") {
      try {
        const { message, messages, session_id } = JSON.parse(await readBody(req));
        let chatMessages: Array<{ role: "user" | "assistant"; content: string }>;
        if (session_id) {
          chatMessages = loadConversation("webhook", session_id);
          if (message) chatMessages.push({ role: "user", content: message });
        } else {
          chatMessages = messages || [{ role: "user" as const, content: message }];
        }
        const response = await chatWithTools(
          config.provider, config.apiKey, config.model,
          systemPrompt, chatMessages, mcpManager, config.ollamaUrl,
        );
        if (session_id) {
          chatMessages.push({ role: "assistant", content: response });
          saveConversation("webhook", session_id, chatMessages);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ response, session_id }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }));
      }
      return;
    }

    // ── Existing: DELETE /chat ──
    if (req.method === "DELETE" && pathname === "/chat") {
      try {
        const { session_id } = JSON.parse(await readBody(req));
        if (session_id) clearConversation("webhook", session_id);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ cleared: true }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }));
      }
      return;
    }

    // ── Static Files (catch-all) ──
    if (req.method === "GET") {
      if (serveStatic(req, res, publicDir)) return;
      // SPA fallback
      const indexPath = path.join(publicDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fs.readFileSync(indexPath));
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, () => {
    console.log(`  Web UI + API on http://localhost:${port}`);
  });
}
