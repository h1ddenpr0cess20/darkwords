# Darkwords

A dark, editorial chat client for the Anthropic API — a port of [Wordmark](https://github.com/h1ddenpr0cess20/Wordmark)'s
feature set onto Claude, with a new UI. Icon rail, manuscript-style feed with
reasoning and tool calls as margin annotations, a floating input bar, and a
left-hand drawer for Settings, History and a media Gallery.

## Stack

- React 19 + TypeScript, built with Vite
- Zustand for state, persisted to IndexedDB
- `@anthropic-ai/sdk`, called directly from the browser (no backend)
- OpenAI Images API (`gpt-image-2`) for the image-generation tool

## Running it

```sh
npm install
npm run dev
```

Then open **Settings → Keys**:

- **Anthropic key** (`sk-ant-…`) — required for chat.
- **OpenAI key** (`sk-…`) — optional; only for image generation.

```sh
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
npm run lint       # type-check only
```

## Features

**Chat** — streaming replies with adaptive thinking, a collapsible reasoning
panel, markdown and syntax-highlighted code, file attachments (images and PDFs
as native content blocks, text files inlined), and a stop control.

**Party mode** — an autonomous multi-character group chat. Define a cast (name,
persona, per-character tool grants) and a scenario (topic, setting, mood,
conversation type), hit **Start party**, and the characters converse on their
own. Type at any time to interject without pausing the loop; name a character
and they take the next turn. Two characters alternate; three or more use a
speaker-decision request to pick who speaks next. Pause, stop, and resume from
the control bar above the input.

**Tools**

| Tool | Runs where |
| --- | --- |
| Web search | Anthropic's servers |
| Code interpreter | Anthropic's servers (sandboxed Python) |
| Image generation | Your browser → OpenAI `gpt-image-2` |
| Memory (`remember` / `forget`) | Your browser |
| Skills (`load_skill`) | Your browser |
| MCP servers | Anthropic's MCP connector |

Anthropic has no image-generation endpoint, so image generation is a
*client-side* tool: Claude calls it, Darkwords fulfils the call against an
external image model, and the result comes back as a tool result and lands in
the feed and Gallery. With no OpenAI key set, the tool isn't offered to the
model at all.

**Memory** — Claude can save brief facts about you with the `remember` tool.
They're kept to a FIFO limit and appended to the system prompt every turn. You
can add, remove and clear them yourself in Settings → Memory.

**Skills** — import `SKILL.md` instruction packages. Only each skill's name and
description sit in the system prompt; Claude pulls the full body in with
`load_skill` when a task matches, so a shelf of skills doesn't flood every
request.

**Prompt modes** — Personality (a name, wrapped in a roleplay instruction),
Custom (a verbatim system prompt), None, or Party.

**Reasoning effort** — `low` … `max`, overriding the model's default.

**Everything is local** — conversations, gallery, memories, skills and keys all
live in this browser's `localStorage`. Export and import the lot as JSON from
Settings → Data (keys are deliberately excluded from exports).

## Model capabilities

Tool selection adapts to the model, because they don't all support the same
things:

- Haiku 4.5 has no extended thinking and no programmatic tool calling, so the
  reasoning-effort control doesn't apply and the code interpreter is withheld.
- `web_search_20260209` filters results by running code under the hood. Declared
  next to an explicit `code_execution` tool it confuses the model into writing
  code for things it should just search, so the basic `web_search_20250305` is
  used whenever code execution is also on.

## Structure

```
src/
  components/       Rail, TopStrip, Feed, MessageRow, InputBar, PartyBar, drawer/…
  store/            Zustand store — state + send/streaming orchestration
  lib/
    anthropic.ts    Messages API streaming client + the tool loop
    images.ts       OpenAI image generation (gpt-image-2)
    prompt.ts       system-prompt composition
    party/          party mode — types, prompts, turn-loop engine
    tools/          client-side tools (image, memory, skills)
    blocks.ts       markdown-ish text -> paragraph/heading/list/code blocks
    highlight.tsx   regex-based code syntax highlighting
    config.ts       models, themes
  types/            shared domain types
  styles/           design tokens + global resets
```

## Notes

- **API keys are client-side by design.** They're kept in this browser and sent
  directly to `api.anthropic.com` and `api.openai.com`. Fine for local
  single-user use; put them behind a backend proxy before deploying anywhere
  shared.
- Per-character sampling temperature does **not** exist in party mode — Opus 4.8
  and Sonnet 5 reject `temperature` outright, so character voice comes from the
  persona prompt alone.
