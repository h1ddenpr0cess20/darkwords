# Darkwords

A dark, editorial chatbot UI for the Anthropic API. Icon rail, manuscript-style
feed with margin annotations for reasoning / tool calls / generated images, a
floating input bar, and a right-side drawer for Settings, History, and a media
Gallery. Supports party mode (multiple named personas replying in sequence),
streaming replies with adaptive thinking, web search, code execution, file
attachments, and image generation.

This app is the implementation of the `Darkwords.dc.html` design exported from
Claude Design — see `chats/chat1.md` for the original design conversation and
`project/` for the source prototype.

## Stack

- React 19 + TypeScript, built with Vite
- Zustand for state (persisted to `localStorage`)
- `@anthropic-ai/sdk` calling the Anthropic API directly from the browser
- OpenAI Images API (`gpt-image-2`) for the image-generation tool

## Running it

```sh
npm install
npm run dev
```

Open the app and go to **Settings → API Key**:

- **Anthropic key** (`sk-ant-…`) — required for chat.
- **OpenAI key** (`sk-…`) — optional; only needed for image generation.

```sh
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
npm run lint       # type-check only
```

## Tools

| Tool | Runs where | Notes |
| --- | --- | --- |
| Web search | Anthropic's servers | `web_search_20260209` |
| Code interpreter | Anthropic's servers | `code_execution_20260521`, sandboxed Python |
| File attachments | — | Images and PDFs go up as native content blocks; text files are inlined |
| Image generation | Your browser → OpenAI | Client-side tool: Claude calls `generate_image`, the app calls `gpt-image-2` and hands the result back |

Anthropic's API has no image-generation endpoint, so image generation is a
**client-side tool**: Claude decides to call it, the app fulfils the call
against an external image model, and the resulting image is returned to Claude
as a tool result and shown in the feed and Gallery. With no OpenAI key set, the
tool is not offered to the model at all.

## Structure

```
src/
  components/       UI components (Rail, Feed, MessageRow, InputBar, Drawer/…)
  store/            Zustand store — app state + the send/streaming orchestration
  lib/
    anthropic.ts    Messages API streaming client (tools, thinking, tool loop)
    images.ts       OpenAI image generation (gpt-image-2)
    blocks.ts       markdown-ish text -> paragraph/heading/list/code blocks
    highlight.tsx   regex-based code syntax highlighting
    config.ts       models, themes, personas (static config)
    color.ts        color helpers
    theme.ts        accent-color hook
  types/            shared domain types
  styles/           design tokens (colors/fonts) + global resets
```

## Notes / known limitations

- **API keys are held client-side by design** — they live in this browser's
  `localStorage` and are sent directly to `api.anthropic.com` and
  `api.openai.com`. That is fine for local single-user use. For a shared or
  production deployment, put the keys behind a backend proxy instead of
  shipping them to the browser.
- The **logo** in the rail is a simple mark — the original design session's
  logo direction was never resolved (see the end of `chats/chat1.md`).
