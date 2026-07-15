# Development Guide

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b` type-check + production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | `tsc --noEmit` + `biome check .` |
| `npm test` | `vitest run` |
| `npm run format` | `biome format --write .` |

## Tooling

- **TypeScript** for types; the build type-checks with project references
  (`tsc -b`).
- **Biome** for lint + format (`biome.json`) — single quotes, 2-space indent,
  120-column width. Suppress a rule inline with a
  `// biome-ignore lint/<rule>: <reason>` comment (see existing uses in
  `src/components/`).
- **Vitest** for tests — files are colocated as `*.test.ts` next to the code
  they cover.

## Where things live

See [Architecture](architecture.md) for the full map. The short version:

- UI in `src/components/` (CSS Modules per component).
- State in `src/store/` — one slice per domain, all typed against the whole
  `AppState`.
- Logic and integrations in `src/lib/` (Anthropic client, models, RAG, images,
  TTS, party, tools, prompt).
- Shared types in `src/types/`.

## Adding a settings tab

The TTS **Voice** tab is a good worked example of a self-contained feature:

1. Add state to a slice (or a new one) — `src/store/slices/ttsSlice.ts` — and
   wire it into `store/types.ts`, the store creator, and `partialize` in
   `useAppStore.ts` if it should persist.
2. Add the tab key to the `SettingsTab` union in `src/types/index.ts`.
3. Build the tab component under `src/components/drawer/tabs/`, reusing the
   shared `SettingsPanel.module.css` classes (`section`, `toolRow`, `switch`,
   `select`, `textarea`, `info`, `warn`).
4. Register it in `SettingsPanel.tsx` (both the `TABS` list and the render
   switch).

## Testing conventions

- Colocate tests with the unit under test (`foo.ts` → `foo.test.ts`).
- Prefer testing pure logic directly (prompt composition, block parsing,
  model/capability resolution, settings reducers) over DOM-heavy paths.
- Mock `fetch` for provider clients rather than making real network calls.

Run the suite with `npm test`. CI runs it on every push and PR.
