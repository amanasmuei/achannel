# achannel

The portable channel layer for AI companions — Telegram, Discord, WhatsApp, webhooks.

`achannel` connects your AI identity to messaging platforms. It loads the full aman ecosystem (identity, tools, workflows, rules, skills) and responds through any configured channel.

## The aman ecosystem

```
Layer 1: acore     — identity (who your AI is)
Layer 2: amem      — memory (what your AI knows)
Layer 3: akit      — tools (what your AI can do)
Layer 4: aflow     — workflows (how your AI works)
Layer 5: arules    — guardrails (what your AI won't do)
Layer 6: askill    — skills (specialized capabilities)
Layer 7: aman      — agent (the orchestrator)
Layer 8: achannel  — channels (where your AI lives)  <-- you are here
```

## Quick start

```bash
# 1. Set up your AI identity first
npx @aman_asmuei/aman

# 2. Add a Telegram channel
npx @aman_asmuei/achannel add telegram

# 3. Start serving
npx @aman_asmuei/achannel serve
```

## CLI

```bash
achannel add <channel>     # set up a channel (telegram, discord, whatsapp, webhook)
achannel remove <channel>  # remove a channel
achannel list              # list configured channels
achannel serve             # start all channels
achannel doctor            # health check
```

## Channels

### Telegram

Set up a bot via [@BotFather](https://t.me/BotFather), get the token, then:

```bash
achannel add telegram
```

Features:
- Personal mode (only responds to you) or public mode
- Conversation memory (last 20 messages per chat)
- `/clear` to reset conversation
- Auto-splits long messages (4000 char limit)

### Discord

Create a bot at [Discord Developer Portal](https://discord.com/developers/applications), get the token, then:

```bash
achannel add discord
```

Features:
- Responds when @mentioned or in DMs
- Per-channel conversation memory
- Auto-splits long messages (1900 char limit)

### Webhook

HTTP endpoint for custom integrations:

```bash
achannel add webhook
```

Endpoints:
- `GET /status` — health check
- `POST /chat` — send a message

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

Or with conversation history:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
```

## LLM providers

achannel supports three providers:

| Provider | Setup | Cost |
|----------|-------|------|
| **Anthropic** (Claude) | API key from console.anthropic.com | Pay per token |
| **OpenAI** (GPT) | API key from platform.openai.com | Pay per token |
| **Ollama** (local) | Install Ollama, pull a model | Free |

## Deploy on Raspberry Pi

Run your AI companion locally, fully offline:

1. Install Node.js and Ollama on your Pi
2. Pull a small model: `ollama pull llama3.2`
3. Set up your identity: `npx @aman_asmuei/aman`
4. Add Telegram: `npx @aman_asmuei/achannel add telegram`
5. Choose Ollama as provider
6. Start: `npx @aman_asmuei/achannel serve`

Your AI is now on Telegram, running locally, fully offline.

## How it works

```
  Telegram ──┐
  Discord  ──┤
  WhatsApp ──┼──> achannel ──> LLM (with full ecosystem context)
  Webhook  ──┘
```

1. A message arrives on any channel
2. achannel loads the ecosystem (acore identity, akit tools, aflow workflows, arules guardrails, askill skills)
3. Sends the message + ecosystem context to your chosen LLM
4. Returns the response through the same channel

## Configuration

All config lives in `~/.achannel/`:

- `config.json` — channel credentials and settings
- `channels.md` — human-readable summary of configured channels

## License

MIT
