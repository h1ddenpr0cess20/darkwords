# Storage

Everything Darkwords keeps lives in **this browser's IndexedDB**. There is no
server and no cloud sync.

## What's persisted

The Zustand `persist` middleware writes a **partialized** slice of state
(`partialize` in `src/store/useAppStore.ts`) under the IndexedDB key
`darkwords-store`. That includes:

- Conversations, their order, and the active conversation
- Provider, selected model, LM Studio URL/model, embedding model
- Theme, tool toggles, reasoning effort
- Prompt mode, personality, custom prompt, verbose flag
- **Voice settings** — enabled, autoplay, voice, instructions
- Memory (enabled, limit, and the memories themselves)
- Skills
- MCP servers
- Gallery items
- **API keys** (Anthropic + OpenAI)

Transient state is **not** persisted and is rebuilt on load: streaming flags,
open panels, party running/paused status, the composer draft, and pending
uploads. Voice **audio** is persisted, but in a **separate** IndexedDB database
(`darkwords-audio`, pruned to the 15 most recent clips), not in the main store —
so it is never part of a data export (see [Voice](voice.md)).

## Persistence mechanics

Writes go through `src/lib/idbStorage.ts`, a **debounced** IndexedDB storage
adapter — rapid state changes coalesce into fewer writes.

`onRehydrateStorage` re-derives party and persona state for the active
conversation after load, and `migrate` upgrades older persisted shapes (bump
`version` when the persisted shape changes).

## Export and import

**Settings → Data** exports the lot as JSON and imports it back. **Keys are
deliberately excluded from exports** — an export is safe to share or back up
without leaking credentials. See [Security](security.md).

## Clearing data

**Settings → Data → Clear all data** wipes conversations, gallery, memories,
skills, MCP servers, and the cached voice clips (the separate `darkwords-audio`
database) — keys are kept. **Settings → Voice → Clear cached audio** clears just
the voice clips.

Removing the site's IndexedDB entirely (via your browser's dev tools or site-data
settings) resets Darkwords to a fresh state, including keys. Exporting first
preserves everything but the keys.
