# Voice (Text-to-Speech)

Darkwords can read assistant replies aloud using OpenAI's speech model
(`gpt-4o-mini-tts`). It's a client-side feature, ported from Wordmark: finished
text is sent straight to OpenAI and the returned WAV audio is played in the
browser.

## Setup

1. Add an **OpenAI key** in **Settings → Keys** (`sk-…`). This is the *same* key
   image generation uses — voice playback reads it from `imageApiKey`.
2. Open **Settings → Voice** and turn on **Text-to-speech**.

Because it only needs the OpenAI key, voice playback works no matter which chat
provider is selected — Anthropic **or** LM Studio.

**Test voice** — the tab has a *Test voice* button that speaks a short sample
phrase with the current voice and instructions, plus a *Stop* button, so you can
audition a voice without sending a message.

Enabling voice playback **does not synthesize anything** for messages already on
screen — they simply gain on-demand play controls. Nothing is generated (and no
tokens are spent) until you press play, or until a *new* reply lands with
autoplay on.

## Controls

When voice is enabled, each assistant message gets inline controls next to the
copy/regenerate actions (`src/components/TtsControls.tsx`):

- **Play / Pause** — synthesizes on first play (with a loading spinner), then
  toggles playback.
- **Stop** — stops and resets to the start (shown once a clip exists).
- **Download** — saves the clip as `tts_<voice>_<timestamp>.wav`, synthesizing
  first if needed.

Only one clip plays at a time. Starting one pauses whatever was playing.

## Autoplay

With **Autoplay** on (the default when voice is enabled), each **newly finished**
reply speaks itself. Autoplay is driven from the turn-finalize path
(`src/lib/ttsAutoplay.ts`), not from the message controls — so it only ever fires
for a reply that just landed, never for messages already in the conversation when
you toggled voice on. Replies are queued and played **sequentially** in order.
Text that reads poorly aloud is skipped for autoplay — empty bodies and messages
containing fenced code blocks (```) — but you can still voice them by hand with
the play button.

## Voice and instructions

**Settings → Voice** offers:

- **Voice** — the `gpt-4o-mini-tts` voice catalog (`src/lib/tts.ts`), e.g. Ash
  (default), Alloy, Coral, Fable, Nova, Onyx, Sage, Shimmer, Verse, and more.
- **Voice instructions** — optional free-text direction for tone and delivery.

Instructions are resolved in order of preference (`buildTtsInstructions`):

1. Your explicit **Voice instructions**, if set.
2. Otherwise, when a **personality** prompt is active, an instruction derived
   from it — with a directive to skip code blocks and `*emote*` text.
3. Otherwise, a neutral conversational tone.

## How it works

- `src/lib/tts.ts` — the OpenAI Speech API client (`generateSpeech`), the voice
  catalog, and `buildTtsInstructions`.
- `src/lib/ttsPlayback.ts` — a module-level controller that owns all audio,
  guarantees a single active clip, exposes per-message state to React via
  `useSyncExternalStore`, drives the autoplay queue, and renders the voice test
  sample.
- `src/lib/ttsAutoplay.ts` — the finalize-time hook that enqueues a *new* reply
  for autoplay (kept out of the components so enabling voice never re-speaks old
  messages).
- `src/store/slices/ttsSlice.ts` — persisted settings (`ttsEnabled`,
  `ttsAutoplay`, `ttsVoice`, `ttsInstructions`).
- `src/lib/audioStorage.ts` — the IndexedDB clip store (ported from Wordmark).

A synthesized clip is cached in memory (object URL + bytes) and **persisted to
IndexedDB**, keyed by message, in a separate `darkwords-audio` database pruned to
the 15 most recent clips. Replaying, downloading, or reopening the conversation
after a reload reuses the stored clip — the provider is **not** called again.
The provider is re-called only when nothing is stored for the message at the
current voice; changing the voice synthesizes (and stores) a new clip. **Clear
cached audio** in Settings → Voice empties the store. The audio store is separate
from the main state and is never included in data exports.

## Notes

- Each play/synthesis is a billed OpenAI request. Autoplay voices every eligible
  reply, so leave it off if you're cost-sensitive.
- If synthesis fails (bad key, network, rate limit), the per-message controls
  show a short error and playback stops; fix the key in **Settings → Keys** and
  try again.
