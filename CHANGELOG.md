# Changelog

All notable changes to Darkwords are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the format of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.3.0] - 2026-07-16

### Added
- **Persona indicator in the header,** showing the active persona for the
  current conversation at a glance.
- **New-chat persona menu.** The New chat button offers the current or default
  persona instead of always starting with the default.
- **Text-size controls.** Buttons in the header scale the message text, and the
  scale now carries through headings, code blocks, and tables rather than body
  copy alone.

### Fixed
- **Mobile layout.** The header row wraps instead of pushing the font-size and
  export controls off screen, the new-chat persona menu is reachable by touch,
  and the party mode cast row and control bar wrap instead of running off the
  right edge.
- **Input bar overlapping the last message in party mode.** The feed now
  measures the input area's real height, so the reserved space always covers the
  party control bar, upload chips, and a growing textarea.
- **Stopping a turn** no longer marks messages as errored or discards stopped
  partial replies; an aborted regeneration restores the previous version.
- **Messages left streaming by a mid-stream reload** are finalized on rehydrate
  instead of spinning forever.
- **Text attachments** decode as UTF-8 (with a Latin-1 fallback) instead of
  turning into mojibake, and unsupported image formats degrade gracefully
  instead of failing the request.
- Data import/export normalizes party prompt mode, whitelists imported settings
  keys, and activates the imported conversation's persona.
- Enter that confirms an IME composition no longer sends the message.
- The TTS autoplay queue keeps draining after a failed synthesis.
- Branching a conversation ends the attached party, and colliding MCP tool names
  are suffixed instead of shadowing each other.

## [1.2.0] - 2026-07-15

### Added
- **Light mode.** A dark/light toggle in Settings → Theme. Light mode swaps the
  app's mean-spirited personas and default personality for polite opposites and
  applies a light colour palette. Each mode keeps its own conversations —
  neither side can open the other's chat history — while settings, keys, and the
  gallery stay shared. The HTML transcript export and desktop titlebar follow the
  active mode.
- **Folder attachments.** Attach an entire folder of files to a message.
- **Service switcher** in the Rail model picker to flip between Anthropic and
  LM Studio without opening Settings.

### Changed
- Message attachments render as a single horizontal-scroll strip, grouped by
  folder.

### Fixed
- LM Studio models now populate in the Rail model switcher.
- Markdown rendering and RAG retrieval bugs.

## [1.1.0] - 2026-07-15

### Fixed
- **Copy in the Electron app** now works, routed through a main-process IPC
  handler since the sandboxed preload has no `clipboard` access.
- **Location** resolves on desktop via browser geolocation with an IP-based
  fallback.

### Changed
- Removed the gray hover background on message action buttons so they match the
  accent-only hover used elsewhere.

## [1.0.0] - 2026-07-15

- Initial release.

[1.3.0]: https://github.com/h1ddenpr0cess20/darkwords/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/h1ddenpr0cess20/darkwords/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/h1ddenpr0cess20/darkwords/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/h1ddenpr0cess20/darkwords/releases/tag/v1.0.0
