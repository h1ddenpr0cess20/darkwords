# Architecture

Darkwords is a single-page React app with no backend. The browser talks
directly to the model provider; a Zustand store holds all state and persists it
to IndexedDB.

## Stack

- **React 19 + TypeScript**, built with **Vite**
- **Zustand** for state, persisted to **IndexedDB**
- **`@anthropic-ai/sdk`**, called directly from the browser — pointed at either
  `api.anthropic.com` or LM Studio's Anthropic-compatible server
- **OpenAI APIs** for two client-side extras: image generation (`gpt-image-2`)
  and voice playback (`gpt-4o-mini-tts`)

## Source layout

```
src/
  components/       Rail, TopStrip, Feed, MessageRow, InputBar, PartyBar, drawer/…
  store/            Zustand store — slices/ per domain, plus streaming callbacks
  lib/
    anthropic/      Messages API streaming client + the tool loop
    models.ts       model catalogs — hardcoded Claude list, LM Studio fetch
    rag/            local document RAG — parsers, embeddings, retrieval
    images.ts       OpenAI image generation (gpt-image-2)
    tts.ts          OpenAI text-to-speech (gpt-4o-mini-tts)
    ttsPlayback.ts  per-message voice playback controller
    prompt.ts       system-prompt composition
    party/          party mode — types, prompts, turn-loop engine
    tools/          client-side tools (image, memory, skills, browser MCP)
    blocks.ts       markdown-ish text -> paragraph/heading/list/code blocks
    highlight.tsx   regex-based code syntax highlighting
    idbStorage.ts   debounced IndexedDB persistence
  types/            shared domain types
  styles/           design tokens + global resets
```

## The store

The store (`src/store/useAppStore.ts`) is a single Zustand store composed of
per-domain **slices**, each written against the whole `AppState` so cross-slice
reads stay typed (`src/store/types.ts`):

| Slice | Responsibility |
| --- | --- |
| `uiSlice` | Drawer/panel state, composer draft, uploads, gallery, lightbox |
| `settingsSlice` | Provider, model, tools, prompt mode, keys, effort |
| `ttsSlice` | Voice-playback settings (see [Voice](voice.md)) |
| `librarySlice` | Memories and skills |
| `dataSlice` | MCP servers, import/export |
| `partySlice` | Party cast/scenario and status |
| `conversationsSlice` | Conversations, ordering, active conversation |
| `chatSlice` | Sending, streaming, regenerate, branch |

The `persist` middleware writes a **partialized** subset (durable state only) to
IndexedDB under the key `darkwords-store`. Transient flags (streaming, open
panels, party status) are rebuilt on load. `onRehydrateStorage` re-derives party
and persona state from whatever the active conversation last saved, and
`migrate` upgrades older persisted shapes — bump `version` when the shape
changes.

## A turn, end to end

1. `chatSlice.send` composes the system prompt (`lib/prompt.ts`), assembles the
   message history, and picks the tool set for the current model.
2. `lib/anthropic/` streams the Messages API response, demultiplexing text,
   reasoning (thinking), and tool-use blocks.
3. Client-side tool calls (image, memory, skills, browser MCP, RAG) are fulfilled
   in the browser and fed back into the tool loop; server-side tools (web search,
   code interpreter) run on Anthropic's side.
4. Streaming callbacks update the active message; margin annotations render the
   reasoning panel and tool calls.
5. On finalize, the text is re-parsed into blocks (`lib/blocks.ts`), and — if
   voice playback is on — the reply can be spoken (see [Voice](voice.md)).

See [Models & Providers](models.md) for how capability flags reshape each
request, and [Tools](tools.md) for where each tool runs.
