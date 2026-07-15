# Darkwords Documentation

Welcome to the Darkwords docs. This folder holds accurate, code-backed notes on
how the app works, how to run it, and how to extend it. Darkwords is a dark,
editorial React chat client for the Anthropic API and local models — a port of
[Wordmark](https://github.com/h1ddenpr0cess20/Wordmark)'s feature set onto
Claude with a new UI.

## Contents

- [Getting Started](getting-started.md) — install, keys, first chat
- [Architecture](architecture.md) — how the pieces fit together
- [Models & Providers](models.md) — Anthropic catalog, LM Studio, capabilities
- [LM Studio (Local Models)](lm-studio.md) — running against local models
- [Tools](tools.md) — web search, code interpreter, image gen, memory, skills, MCP, RAG
- [Voice (Text-to-Speech)](voice.md) — reading replies aloud with OpenAI TTS
- [Party Mode](party-mode.md) — autonomous multi-character group chat
- [Memory](memory.md) — facts the assistant keeps about you
- [Skills](skills.md) — on-demand SKILL.md instruction packages
- [Documents & Attachments](documents.md) — files, PDFs, and local RAG
- [Storage](storage.md) — what's persisted, and where
- [Theming & UI](theming.md) — accent themes, layout, responsive behavior
- [Deployment](deployment.md) — Docker, Vercel, and the keys-in-browser caveat
- [Desktop app](electron.md) — Electron development, packaging, and releases
- [Development Guide](development.md) — scripts, structure, conventions
- [Security](security.md) — the client-side-keys trust model
- [Troubleshooting](troubleshooting.md) — common problems and fixes

## Policies

- [AI Output Disclaimer and Conditions of Use](ai-output-disclaimer.md)
- [Not a Companion](not-a-companion.md)

## The one-paragraph tour

Everything runs in the browser. Darkwords calls `api.anthropic.com` (or an
LM Studio server) directly with the `@anthropic-ai/sdk`, streams replies with a
collapsible reasoning panel, and renders tool calls as margin annotations.
State lives in a Zustand store persisted to IndexedDB — conversations, gallery,
memories, skills, and keys never leave your browser. See
[Security](security.md) before deploying anywhere shared.
