# Troubleshooting

## Chat

**"Invalid API key" / 401 from Anthropic.** Check the key in **Settings → Keys**
starts with `sk-ant-` and is current. Keys are per-browser; a fresh browser or
cleared site data needs the key re-entered.

**Nothing streams / requests fail with a CORS error.** On a deployed host, use
the Anthropic proxy path (`vercel.json` rewrites `/anthropic/*` to the API). For
local dev this isn't needed.

## LM Studio

**Model list is empty.** A model must be **loaded** in LM Studio's server tab — a
running server with no model returns nothing.

**"LM Studio not reachable".** Confirm the server is started and the URL in
**Settings → Model** matches (default `http://localhost:1234`). Trailing slashes
are trimmed automatically.

**Reasoning panel never appears on a local model.** The server may not advertise
reasoning. Models that emit `<think>…</think>` inline are still split into the
panel; models that don't reason won't show one. See [LM Studio](lm-studio.md).

## Tools

**Web search / code interpreter missing.** They're **Anthropic-only** server
tools — unavailable with LM Studio. Code interpreter is also withheld for
Haiku 4.5 (no programmatic tool calling).

**Image generation does nothing / tool isn't offered.** It needs an **OpenAI
key** in **Settings → Keys** and the **Image generation** toggle on in
**Settings → Tools**. With no key, the tool isn't offered to the model at all.

## Voice (TTS)

**No voice controls on messages.** Turn on **Text-to-speech** in
**Settings → Voice**, and make sure an **OpenAI key** is set (voice reuses the
image key).

**Playback shows an error.** Usually a bad/expired OpenAI key, a rate limit, or a
network failure. Fix the key and try again — the clip re-synthesizes on next
play. See [Voice](voice.md).

**A reply wasn't auto-spoken.** Autoplay skips empty messages and anything with
fenced code blocks (```). Use the play button to voice it by hand.

## Documents

**Attached document isn't searched on LM Studio.** Local RAG needs an
**embedding model** loaded in LM Studio. Pin one in **Settings → Model** or let
auto-detect find it. See [Documents](documents.md).

## Data

**Lost my conversations after clearing site data.** Everything lives in this
browser's IndexedDB; clearing it resets Darkwords. Export from **Settings → Data**
first (note: exports exclude keys). See [Storage](storage.md).
