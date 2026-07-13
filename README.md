# Darkwords

A dark, editorial chatbot UI for the Anthropic API. Icon rail, manuscript-style
feed with margin annotations for reasoning/tool-calls/generated images, a
floating input bar, and a right-side drawer for Settings, History, and a
media Gallery. Supports party mode (multiple named personas replying in
sequence), real streaming replies, extended thinking, web search, code
execution, and image generation (via a client-defined tool, since Anthropic
doesn't offer a native image-gen endpoint — generated art is a placeholder
gradient tagged with the model's prompt).

This app is the implementation of the `Darkwords.dc.html` design exported
from Claude Design — see `chats/chat1.md` for the original design
conversation and `project/` for the source prototype.

## Stack

- React + TypeScript, built with Vite
- Zustand for state (persisted to `localStorage`)
- `@anthropic-ai/sdk` calling the Anthropic API directly from the browser

## Running it

```sh
npm install
npm run dev
```

Open the app, go to **Settings → API Key**, and paste an Anthropic API key
(`sk-ant-…`). The key is stored only in your browser's `localStorage` and
sent only to `api.anthropic.com` — there is no backend server here.

```sh
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
npm run lint       # type-check only
```

## Structure

```
src/
  components/       UI components (Rail, Feed, MessageRow, InputBar, Drawer/…)
  store/            Zustand store — app state + the send/streaming orchestration
  lib/
    anthropic.ts    Anthropic Messages API streaming client (tools, thinking)
    blocks.ts       markdown-ish text -> paragraph/heading/list/code blocks
    highlight.tsx   regex-based code syntax highlighting
    config.ts       models, themes, personas (static config)
    seed.ts         demo conversations/gallery shown on first load
    theme.ts        accent-color hook
  types/            shared domain types
  styles/           design tokens (colors/fonts) + global resets
```

## Notes / known limitations

- **Image generation** is a custom client-side tool, not a real Anthropic
  capability — the model can "call" it, but the result is placeholder
  gradient art, not a real generated image.
- **API key handling** is client-side by design (matches the original
  mockup's own claim of "stored locally, never sent anywhere but
  Anthropic"). For a multi-user or production deployment you'd want a
  backend proxy instead of shipping the key to the browser.
- The **logo** in the rail is a placeholder — the original design session's
  logo direction was never resolved (see the end of `chats/chat1.md`).
