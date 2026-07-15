# Theming & UI

Darkwords uses an icon-rail layout: a manuscript-style feed
with reasoning and tool calls as margin annotations, a floating input bar, and a
left-hand drawer.

## Layout

- **Rail** — the icon strip for Settings, History, and the Gallery. On small
  screens it becomes a **bottom bar**.
- **Feed** — the message list. Each `MessageRow` shows the avatar, name, time,
  body (rendered from markdown), any attachments/generated images, per-message
  actions, and margin annotations.
- **Margin annotations** — the collapsible reasoning panel and tool calls sit in
  the margin beside each message (`MarginAnnotations`).
- **Input bar** — a floating composer with attachment support and a stop control.
- **Drawer** — Settings, History, and Gallery panels. On small screens it becomes
  a **full-width sheet**.

## Accent themes

**Settings → Theme** picks an accent color (`themeId`). The palette is defined in
`src/lib/config.ts`:

| Theme | Accent |
| --- | --- |
| Ember (default) | `#E8B54D` |
| Slate | `#A9B4C0` |
| Ink | `#7EE787` |
| Dusk | `#8FB9FF` |
| Violet | `#B388FF` |
| Crimson | `#FF6B6B` |
| Rose | `#FF8FC9` |
| Teal | `#5FD9C8` |

The accent flows through CSS custom properties (`--accent`, `--accent-bg`,
`--accent-border`) set per row and read by the design tokens in
`src/styles/tokens.css`. `useAccent` (`src/lib/theme.ts`) resolves the active
accent for components that need the raw value (avatars, names, controls).

## Styling conventions

- Components use **CSS Modules** (`*.module.css`) scoped per component.
- Global resets and design tokens live in `src/styles/` (`global.css`,
  `tokens.css`).
- Colors are addressed through token variables (`--text-0` … `--text-8`,
  `--row-bg`, `--accent`, …) rather than hardcoded values, so a theme change
  restyles everything at once.

## Reduced/hover-less input

Per-message controls reveal on hover on pointer devices and stay visible on
touch screens (`@media (hover: none)`), so they're always reachable.
