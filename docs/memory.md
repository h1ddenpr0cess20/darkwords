# Memory

Claude can save brief facts about you and recall them in later turns. Memories
are stored in your browser and appended to the system prompt each turn.

## How it works

- The assistant calls the **`remember`** tool to save a fact, and **`forget`** to
  drop one (`src/lib/tools/memory.ts`).
- Memories are kept to a **FIFO limit** — when full, the oldest is dropped as new
  ones arrive.
- Every stored memory is appended to the system prompt on every turn, so the
  model stays aware of them.

## Managing memories yourself

Open **Settings → Memory** to:

- Toggle memory on or off (`memoryEnabled`).
- Set the FIFO limit (`memoryLimit`).
- Add, edit, remove, or clear individual memories.

Each memory is a short piece of text with a creation timestamp (`Memory` in
`src/types/index.ts`). They live in `librarySlice` and are persisted to
IndexedDB — see [Storage](storage.md).

## Notes

- Memory is separate from conversation history: a memory persists across
  conversations and reloads, whereas a conversation is a single transcript.
- Because memories are injected into the system prompt, a large number of them
  consumes context; the FIFO limit keeps this bounded.
- Memories are included in data exports (keys are not). See
  [Storage](storage.md).
