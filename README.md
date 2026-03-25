<div align="center">

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/achannel-channel_layer-white?style=for-the-badge&labelColor=0d1117&color=58a6ff">
  <img alt="achannel" src="https://img.shields.io/badge/achannel-channel_layer-black?style=for-the-badge&labelColor=f6f8fa&color=24292f">
</picture>

### The portable channel layer for AI companions.

Connect your AI identity to Telegram, Discord, WhatsApp, and webhooks — with full ecosystem context in every message.

<br>

[![npm](https://img.shields.io/npm/v/@aman_asmuei/achannel?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@aman_asmuei/achannel)
[![CI](https://img.shields.io/github/actions/workflow/status/amanasmuei/achannel/ci.yml?style=flat-square&label=tests)](https://github.com/amanasmuei/achannel/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)
[![aman](https://img.shields.io/badge/part_of-aman_ecosystem-ff6b35.svg?style=flat-square)](https://github.com/amanasmuei/aman)

[Quick Start](#quick-start) · [Channels](#channels) · [LLM Providers](#llm-providers) · [Deploy](#deploy-on-raspberry-pi) · [Ecosystem](#the-ecosystem)

</div>

---

## The Problem

Your AI companion lives in a terminal. But you're on Telegram, Discord, and other platforms all day. There's no bridge between your ecosystem and the platforms where you actually communicate.

## The Solution

**achannel** connects your AI identity to messaging platforms. Full ecosystem context — identity, tools, workflows, rules, skills — in every response.

```bash
npx @aman_asmuei/achannel add telegram
npx @aman_asmuei/achannel serve
```

> **Same AI. Same personality. Same rules. Any platform.**

---

## Quick Start

```bash
# 1. Set up your AI identity first
npx @aman_asmuei/aman

# 2. Add a channel
npx @aman_asmuei/achannel add telegram

# 3. Start serving
npx @aman_asmuei/achannel serve
```

---

## How It Works

```
  Telegram ──┐
  Discord  ──┤
  WhatsApp ──┼──> achannel ──> LLM (with full ecosystem context)
  Webhook  ──┘
```

1. A message arrives on any channel
2. achannel loads the ecosystem (identity, tools, workflows, guardrails, skills)
3. Sends the message + ecosystem context to your chosen LLM
4. Returns the response through the same channel

---

## Commands

| Command | What it does |
|:--------|:-------------|
| `achannel add <channel>` | Set up a channel (telegram, discord, whatsapp, webhook) |
| `achannel remove <channel>` | Remove a channel |
| `achannel list` | List configured channels |
| `achannel serve` | Start all channels |
| `achannel doctor` | Health check |

---

## Channels

<details>
<summary><strong>Telegram</strong></summary>

Set up a bot via [@BotFather](https://t.me/BotFather), get the token, then:

```bash
achannel add telegram
```

**Features:**
- Personal mode (only responds to you) or public mode
- Conversation memory (last 20 messages per chat)
- `/clear` to reset conversation
- Auto-splits long messages (4000 char limit)

</details>

<details>
<summary><strong>Discord</strong></summary>

Create a bot at [Discord Developer Portal](https://discord.com/developers/applications), get the token, then:

```bash
achannel add discord
```

**Features:**
- Responds when @mentioned or in DMs
- Per-channel conversation memory
- Auto-splits long messages (1900 char limit)

</details>

<details>
<summary><strong>Webhook</strong></summary>

HTTP endpoint for custom integrations:

```bash
achannel add webhook
```

**Endpoints:**

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/status` | Health check |
| `POST` | `/chat` | Send a message |

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

</details>

---

## LLM Providers

| Provider | Setup | Cost |
|:---------|:------|:-----|
| **Anthropic** (Claude) | API key from [console.anthropic.com](https://console.anthropic.com) | Pay per token |
| **OpenAI** (GPT) | API key from [platform.openai.com](https://platform.openai.com) | Pay per token |
| **Ollama** (local) | Install [Ollama](https://ollama.ai), pull a model | Free |

---

## Deploy on Raspberry Pi

Run your AI companion locally, fully offline:

```bash
# 1. Install Node.js and Ollama on your Pi
# 2. Pull a small model
ollama pull llama3.2

# 3. Set up your identity
npx @aman_asmuei/aman

# 4. Add Telegram and choose Ollama as provider
npx @aman_asmuei/achannel add telegram

# 5. Start
npx @aman_asmuei/achannel serve
```

> **Your AI is now on Telegram, running locally, fully offline.**

---

## Configuration

All config lives in `~/.achannel/`:

| File | Purpose |
|:-----|:--------|
| `config.json` | Channel credentials and settings |
| `channels.md` | Human-readable summary of configured channels |

---

## The Ecosystem

```
aman
├── acore      → identity    → who your AI IS
├── amem       → memory      → what your AI KNOWS
├── akit       → tools       → what your AI CAN DO
├── aflow      → workflows   → HOW your AI works
├── arules     → guardrails  → what your AI WON'T do
├── askill     → skills      → what your AI MASTERS
├── aeval      → evaluation  → how GOOD your AI is
└── achannel   → channels    → WHERE your AI lives  ← YOU ARE HERE
```

| Layer | Package | What it does |
|:------|:--------|:-------------|
| Identity | [acore](https://github.com/amanasmuei/acore) | Personality, values, relationship memory |
| Memory | [amem](https://github.com/amanasmuei/amem) | Automated knowledge storage (MCP) |
| Tools | [akit](https://github.com/amanasmuei/akit) | 15 portable AI tools (MCP + manual fallback) |
| Workflows | [aflow](https://github.com/amanasmuei/aflow) | Reusable AI workflows |
| Guardrails | [arules](https://github.com/amanasmuei/arules) | Safety boundaries and permissions |
| Skills | [askill](https://github.com/amanasmuei/askill) | Domain expertise |
| Evaluation | [aeval](https://github.com/amanasmuei/aeval) | Relationship tracking |
| **Unified** | **[aman](https://github.com/amanasmuei/aman)** | **One command to set up everything** |

---

## Contributing

Contributions welcome! Add channel adapters, improve platform support, or suggest features.

## License

[MIT](LICENSE)

---

<div align="center">

**One identity. Every platform. Your AI everywhere.**

</div>
