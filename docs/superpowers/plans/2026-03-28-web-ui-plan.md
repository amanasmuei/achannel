# aman Web UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a web-based chat dashboard to achannel, making aman accessible from any browser on any device.

**Architecture:** Extend achannel's webhook HTTP server to serve static files (public/), add SSE streaming endpoint, add REST API endpoints for dashboard data. Frontend is static HTML/CSS/JS with no build step.

**Tech Stack:** Node.js HTTP server, SSE (Server-Sent Events), Anthropic/OpenAI streaming APIs, vanilla HTML/CSS/JS

---

## File Structure

| Action | File | Responsibility |
|:---|:---|:---|
| Modify | `achannel/src/channels/webhook.ts` | Add static file serving, SSE endpoint, API routes |
| Modify | `achannel/src/lib/llm.ts` | Add streaming chat function with tool loop |
| Modify | `achannel/package.json` | Add `public` to `files` array, bump version |
| Create | `achannel/public/index.html` | Dashboard HTML shell |
| Create | `achannel/public/style.css` | Responsive styles, dark/light theme |
| Create | `achannel/public/app.js` | Chat logic, SSE, API calls, tab routing |

---

## Chunk 1: Backend — Streaming LLM + API Endpoints

### Task 1: Add streaming chat function to llm.ts

**Files:**
- Modify: `achannel/src/lib/llm.ts`

- [ ] **Step 1: Add streamChatWithTools function**

Add after the existing `chatWithTools` function:

```typescript
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
    let currentMessages: Anthropic.Messages.MessageParam[] = messages.map(
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

    let toolUseBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
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

    // Execute tools if any
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

      // Second pass (non-streaming for simplicity after tools)
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
  const clientOpts: Record<string, unknown> = { apiKey };
  if (provider === "ollama") {
    clientOpts.baseURL = ollamaUrl || "http://localhost:11434/v1";
    clientOpts.apiKey = "ollama";
  }
  const client = new OpenAI(clientOpts as ConstructorParameters<typeof OpenAI>[0]);

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
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/aman-asmuei/project-aman/achannel && npm run build`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
git add src/lib/llm.ts
git commit -m "feat: add streaming chat function with SSE-compatible callbacks"
```

### Task 2: Add static file serving + SSE + API to webhook.ts

**Files:**
- Modify: `achannel/src/channels/webhook.ts`

- [ ] **Step 1: Rewrite webhook.ts with static serving, SSE, and API routes**

Replace the entire file with the expanded version that adds:
- Static file serving from `public/` directory (resolves from package root)
- `GET /chat/stream?message=&session_id=` SSE endpoint
- `GET /api/status` ecosystem status
- `GET /api/plans` plan list
- `GET /api/profiles` profile list
- `GET /api/teams` team list
- `GET /api/memory?q=` memory search
- All existing endpoints preserved (POST /chat, DELETE /chat, GET /status)

```typescript
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
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function getPublicDir(): string {
  // Resolve public/ relative to package root
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
  filePath = filePath.split("?")[0]; // strip query string

  // Security: no path traversal
  const resolved = path.resolve(publicDir, "." + filePath);
  if (!resolved.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return false; // not a static file, continue to API routes
  }

  const ext = path.extname(resolved);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(resolved);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
  return true;
}

function parseQuery(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const idx = url.indexOf("?");
  if (idx < 0) return params;
  const qs = url.slice(idx + 1);
  for (const pair of qs.split("&")) {
    const [k, v] = pair.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  }
  return params;
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
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
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url || "/";
    const pathname = url.split("?")[0];

    // --- SSE Streaming Chat ---
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

      let chatMessages = loadConversation("webhook", sessionId);
      chatMessages.push({ role: "user", content: message });

      try {
        const response = await streamChatWithTools(
          config.provider,
          config.apiKey,
          config.model,
          systemPrompt,
          chatMessages,
          mcpManager,
          (event, data) => {
            res.write(`event: ${event}\ndata: ${data}\n\n`);
          },
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

    // --- API Routes ---

    if (req.method === "GET" && pathname === "/api/status") {
      const layers: Record<string, unknown> = {};
      const files = [
        { name: "identity", path: path.join(home, ".acore", "core.md") },
        { name: "rules", path: path.join(home, ".arules", "rules.md") },
        { name: "workflows", path: path.join(home, ".aflow", "flow.md") },
        { name: "tools", path: path.join(home, ".akit", "kit.md") },
        { name: "skills", path: path.join(home, ".askill", "skills.md") },
        { name: "eval", path: path.join(home, ".aeval", "eval.md") },
      ];
      for (const f of files) {
        layers[f.name] = fs.existsSync(f.path);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", provider: config.provider, model: config.model, layers }));
      return;
    }

    if (req.method === "GET" && pathname === "/api/plans") {
      const plansDir = path.join(process.cwd(), ".acore", "plans");
      const globalPlansDir = path.join(home, ".acore", "plans");
      const dir = fs.existsSync(plansDir) ? plansDir : globalPlansDir;
      const plans: unknown[] = [];
      if (fs.existsSync(dir)) {
        for (const file of fs.readdirSync(dir)) {
          if (!file.endsWith(".md")) continue;
          const content = fs.readFileSync(path.join(dir, file), "utf-8");
          plans.push({ name: file.replace(".md", ""), content });
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(plans));
      return;
    }

    if (req.method === "GET" && pathname === "/api/profiles") {
      const profilesDir = path.join(home, ".acore", "profiles");
      const profiles: unknown[] = [];
      if (fs.existsSync(profilesDir)) {
        for (const entry of fs.readdirSync(profilesDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const corePath = path.join(profilesDir, entry.name, "core.md");
          if (!fs.existsSync(corePath)) continue;
          const content = fs.readFileSync(corePath, "utf-8");
          const nameMatch = content.match(/^# (.+)/m);
          const personalityMatch = content.match(/- Personality:\s*(.+)/);
          profiles.push({
            name: entry.name,
            aiName: nameMatch?.[1]?.trim() || entry.name,
            personality: personalityMatch?.[1]?.trim() || "",
          });
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(profiles));
      return;
    }

    if (req.method === "GET" && pathname === "/api/teams") {
      const teamsDir = path.join(home, ".acore", "teams");
      const teams: unknown[] = [];
      if (fs.existsSync(teamsDir)) {
        for (const file of fs.readdirSync(teamsDir)) {
          if (!file.endsWith(".json")) continue;
          try {
            teams.push(JSON.parse(fs.readFileSync(path.join(teamsDir, file), "utf-8")));
          } catch { /* skip */ }
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(teams));
      return;
    }

    if (req.method === "GET" && pathname === "/api/memory") {
      const params = parseQuery(url);
      const query = params.q || "";
      if (!query || !mcpManager) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
        return;
      }
      try {
        const result = await mcpManager.callTool("memory_recall", { query, limit: 10 });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(result);
      } catch {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }
      return;
    }

    // --- Existing Endpoints ---

    if (req.method === "GET" && pathname === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", provider: config.provider, model: config.model }));
      return;
    }

    if (req.method === "POST" && pathname === "/chat") {
      try {
        const body = await readJsonBody(req);
        const message = body.message as string | undefined;
        const messages = body.messages as Array<{ role: "user" | "assistant"; content: string }> | undefined;
        const session_id = body.session_id as string | undefined;

        let chatMessages: Array<{ role: "user" | "assistant"; content: string }>;
        if (session_id) {
          chatMessages = loadConversation("webhook", session_id);
          if (message) chatMessages.push({ role: "user", content: message });
        } else {
          chatMessages = messages || [{ role: "user" as const, content: message || "" }];
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
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: errMsg }));
      }
      return;
    }

    if (req.method === "DELETE" && pathname === "/chat") {
      try {
        const body = await readJsonBody(req);
        const session_id = body.session_id as string;
        if (session_id) clearConversation("webhook", session_id);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ cleared: true }));
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: errMsg }));
      }
      return;
    }

    // --- Static Files (catch-all) ---
    if (req.method === "GET") {
      if (serveStatic(req, res, publicDir)) return;
      // SPA fallback: serve index.html for unknown routes
      const indexPath = path.join(publicDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
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
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/aman-asmuei/project-aman/achannel && npm run build`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
git add src/channels/webhook.ts
git commit -m "feat: add static file serving, SSE streaming, and REST API to webhook"
```

### Task 3: Update package.json to include public/ in npm package

**Files:**
- Modify: `achannel/package.json`

- [ ] **Step 1: Add public to files array and bump version**

Change `"files": ["dist", "bin"]` to `"files": ["dist", "bin", "public"]`

Change version to `"0.3.0"`

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: include public/ in npm package, bump to 0.3.0"
```

---

## Chunk 2: Frontend — HTML + CSS + JS

### Task 4: Create the HTML shell

**Files:**
- Create: `achannel/public/index.html`

- [ ] **Step 1: Create index.html**

The HTML shell includes:
- Header with aman logo text + theme toggle + hamburger menu
- Sidebar (collapsible on mobile) with profile, plan, skills, memory stats
- Tab navigation: Chat, Plans, Profiles, Teams, Memory, Settings
- Main content area that swaps based on active tab
- Chat input bar fixed at bottom
- Links to style.css and app.js

- [ ] **Step 2: Verify it loads**

Run: `open achannel/public/index.html` in browser
Expected: Page loads with layout structure visible

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add web UI HTML shell with tabs, sidebar, chat input"
```

### Task 5: Create styles

**Files:**
- Create: `achannel/public/style.css`

- [ ] **Step 1: Create style.css**

Includes:
- CSS custom properties for dark + light themes
- CSS Grid layout (sidebar + main)
- Responsive breakpoints (mobile <768px, desktop >=768px)
- Chat bubbles (user right, AI left)
- Tab navigation (horizontal scroll on mobile)
- Sidebar with collapsible toggle
- Progress bar component
- Message input bar
- Typing indicator animation
- Tool execution indicator

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat: add responsive CSS with dark/light theme, chat bubbles, sidebar"
```

### Task 6: Create app logic

**Files:**
- Create: `achannel/public/app.js`

- [ ] **Step 1: Create app.js**

Includes:
- Hash-based tab router (#chat, #plans, #profiles, #teams, #memory, #settings)
- SSE connection for streaming chat (EventSource to /chat/stream)
- Chat message rendering with markdown (basic: bold, italic, code, code blocks, lists)
- Session management (session_id in localStorage)
- Sidebar data loading (fetch /api/status, /api/plans, /api/profiles)
- Plan page: display plans, toggle checkboxes
- Profile page: list profiles
- Team page: list teams
- Memory page: search form → fetch /api/memory?q=
- Settings page: show current provider/model
- Theme toggle (dark/light, saved in localStorage)
- Mobile hamburger menu toggle

- [ ] **Step 2: Test the full stack**

Run: `cd /Users/aman-asmuei/project-aman/achannel && npm run build`
Then: Start with a test config or mock
Expected: Build succeeds, frontend loads at localhost:3000

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: add web UI app logic — chat, plans, profiles, teams, memory, settings"
```

---

## Chunk 3: Integration + Release

### Task 7: Build, test end-to-end, release

- [ ] **Step 1: Build achannel**

Run: `cd /Users/aman-asmuei/project-aman/achannel && npm run build`
Expected: Build success

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit final changes**

```bash
git add -A
git commit -m "feat: aman web UI — chat dashboard accessible from any browser"
```

- [ ] **Step 4: Push and release**

```bash
git push origin main
gh release create v0.3.0 --title "v0.3.0" --notes "feat: web UI dashboard"
```
