# Getting Started

Darkwords is a browser app — there is no backend. You install dependencies, run
a dev server, and everything (keys included) stays in your browser.

## Requirements

- Node.js **20+** (see `engines` in `package.json`)
- An **Anthropic API key** (`sk-ant-…`) for chatting with Claude, **or** a
  running **LM Studio** server for local models
- Optionally an **OpenAI key** (`sk-…`) for image generation and voice playback

## Install and run

```sh
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

## Add your keys

Open the drawer → **Settings → Keys**:

- **Anthropic key** (`sk-ant-…`) — required for chat with Claude.
- **OpenAI key** (`sk-…`) — optional; used by the image-generation tool and by
  voice playback (text-to-speech). Both share this one key.

Keys are stored in this browser's IndexedDB and sent directly to the provider.
They are deliberately excluded from data exports. See [Security](security.md).

## Or go fully local

Switch **Settings → Model** to **LM Studio** to chat with local models — no key
needed, just LM Studio running with its server enabled (default
`http://localhost:1234`). See [LM Studio](lm-studio.md).

## Build commands

```sh
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
npm run lint       # tsc --noEmit + biome check
npm test           # vitest run
npm run format     # biome format --write
```

## First chat

1. Pick a model in **Settings → Model** (Sonnet 5 is the default).
2. Optionally set a **Personality** in **Settings → Personality** — Darkwords
   ships with a deliberately cold, contemptuous default persona.
3. Type in the floating input bar and send. Replies stream in, with reasoning
   and tool calls shown as margin annotations.

Next: [Architecture](architecture.md) or [Tools](tools.md).
