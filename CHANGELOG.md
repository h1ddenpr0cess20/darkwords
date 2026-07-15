# Changelog

All notable changes to Darkwords are documented here. This project follows
[Semantic Versioning](https://semver.org/) and the format of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

[1.2.0]: https://github.com/h1ddenpr0cess20/darkwords/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/h1ddenpr0cess20/darkwords/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/h1ddenpr0cess20/darkwords/releases/tag/v1.0.0
