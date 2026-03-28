# aman Web UI — Chat Dashboard

## Summary

Add a web-based chat dashboard to achannel, making the aman ecosystem accessible from any browser on any device. Static HTML/CSS/JS served from achannel's existing HTTP server, with SSE streaming for real-time responses.

## Motivation

aman-agent is terminal-only — excluding ~95% of humans. A web UI served on port 3000 makes the AI companion accessible from phones, tablets, and any browser. Combined with Docker deployment (`aman deploy`), this means anyone with a Raspberry Pi or $5 VPS can run a personal AI accessible from their phone.

## Architecture

```
Browser (phone/tablet/desktop)
    │
    ├── GET /                → index.html (single-page dashboard)
    ├── GET /assets/*        → CSS, JS, icons (static files)
    ├── POST /chat           → existing JSON chat API (unchanged)
    ├── GET /chat/stream     → NEW: SSE streaming endpoint
    ├── GET /api/status      → ecosystem status (layers, tools, memory count)
    ├── GET /api/plans       → plan list + active plan
    ├── POST /api/plans      → create/update plans
    ├── GET /api/profiles    → available profiles
    ├── GET /api/teams       → available teams
    ├── POST /api/teams/run  → run a team task
    ├── GET /api/memory      → search memories (?q=query)
    └── GET /api/settings    → current config (provider, model, hooks)
```

### Static File Serving

achannel's webhook HTTP server serves files from `achannel/public/` directory:
- `public/index.html` — main dashboard (single-page app)
- `public/style.css` — styles
- `public/app.js` — application logic
- `public/favicon.ico` — icon

Any request not matching `/chat`, `/api/*`, or `/status` serves from `public/`.

### SSE Streaming Endpoint

```
GET /chat/stream?message=hello&session_id=abc123

Response (text/event-stream):

event: text
data: Here's

event: text
data: my response

event: tool
data: {"name":"memory_recall","status":"running"}

event: tool
data: {"name":"memory_recall","status":"done","result":"..."}

event: done
data: {"session_id":"abc123"}
```

Uses aman-agent's streaming LLM client (not achannel's current non-streaming `chatWithTools`). This requires porting the streaming + tool loop from aman-agent to achannel.

### LLM Upgrade

achannel currently uses a simple `chatWithTools()` that returns a full string. Upgrade to use aman-agent's pattern:
- Streaming via `onChunk` callback → piped to SSE
- Full agentic tool loop (LLM → tool calls → LLM → ...)
- Profile-aware system prompt assembly

## Frontend Design

### Layout (Responsive)

**Desktop (>768px):**
```
┌─────────────────────────────────────────────────────┐
│  aman                              [theme] [menu]   │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  Main Content                            │
│          │                                          │
│ Profile  │  [Chat] [Plans] [Teams] [Memory] [Setup] │
│ Plan     │  ┌────────────────────────────────────┐  │
│ Skills   │  │                                    │  │
│ Memory   │  │  Conversation / Page Content       │  │
│ Status   │  │                                    │  │
│          │  │                                    │  │
│          │  ├────────────────────────────────────┤  │
│          │  │ [Type a message...]        [Send]  │  │
│          │  └────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌──────────────────────────┐
│  aman            [≡]     │
├──────────────────────────┤
│ [Chat][Plans][Teams]...  │
├──────────────────────────┤
│                          │
│  Conversation / Content  │
│                          │
│                          │
├──────────────────────────┤
│ [Type a message...][Send]│
└──────────────────────────┘
```

Sidebar slides in from left on hamburger tap. Tabs scroll horizontally.

### Pages

**Chat (default):**
- Message bubbles (user right, AI left)
- Streaming text with typing indicator
- File/image upload button
- Profile selector dropdown
- Markdown rendering in messages
- Tool execution indicators (`[using memory_recall...]`)

**Plans:**
- Active plan with interactive checkboxes
- Progress bar
- Create new plan form (name, goal, steps)
- Plan list with switch button

**Profiles:**
- Profile cards (name, AI name, personality)
- Create from template (coder/writer/researcher)
- Create custom
- Active profile indicator

**Teams:**
- Team list with member badges
- Run task form (select team, enter task)
- Execution results display
- Create from template

**Memory:**
- Search bar with results
- Memory type filters (decision, fact, pattern, etc.)
- Memory timeline graph
- Memory count stats

**Settings:**
- Current provider + model display
- Hook toggles (checkboxes)
- Theme toggle (dark/light)
- Session info

### Styling

- CSS custom properties for theming (dark + light)
- Dark default (matches terminal aesthetic)
- System font stack (no web fonts to load)
- CSS Grid for layout
- Smooth transitions for sidebar, tabs
- Accent color: `#58a6ff` (matches aman badge)

## Backend Changes (achannel)

### Files to Modify

| File | Change |
|:---|:---|
| `src/channels/webhook.ts` | Add static file serving, SSE endpoint, API routes |
| `src/lib/llm.ts` | Upgrade to streaming with tool loop (port from aman-agent) |

### Files to Create

| File | Purpose |
|:---|:---|
| `public/index.html` | Dashboard shell + tab router |
| `public/style.css` | Responsive styles, dark/light theme |
| `public/app.js` | Chat logic, SSE, API calls, tab routing |

### API Endpoints (New)

All endpoints read from existing ecosystem files and MCP tools:

| Endpoint | Source |
|:---|:---|
| `GET /api/status` | Read ecosystem layer files + tool count |
| `GET /api/plans` | Read `.acore/plans/*.md` |
| `POST /api/plans` | Write to `.acore/plans/` |
| `GET /api/profiles` | Read `~/.acore/profiles/` |
| `GET /api/teams` | Read `~/.acore/teams/` |
| `POST /api/teams/run` | Execute team via delegation engine |
| `GET /api/memory?q=` | Call `memory_recall` via MCP |
| `GET /api/settings` | Read `~/.aman-agent/config.json` |

## Out of Scope (v1)

- User authentication (single-user, local network)
- File upload via web (use file paths in messages for now)
- Voice input/output
- Push notifications
- Multi-user support
- PWA / service worker
