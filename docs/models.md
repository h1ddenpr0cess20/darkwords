# Models & Providers

Darkwords speaks to one of two backends, chosen in **Settings → Model**:

- **Anthropic** (`api.anthropic.com`) — a fixed Claude catalog.
- **LM Studio** — whatever chat models the local server reports.

Both are driven through the `@anthropic-ai/sdk`; LM Studio is reached via its
Anthropic-compatible server endpoint. The `provider` and model ids live in
`settingsSlice`; the catalogs and capability logic live in `src/lib/models.ts`.

## The Claude catalog

The Anthropic catalog is hardcoded (`ANTHROPIC_MODELS`):

| Model | Id | Notes |
| --- | --- | --- |
| Claude Fable 5 | `claude-fable-5` | Most intelligent, Mythos-class |
| Claude Opus 4.8 | `claude-opus-4-8` | Most capable Opus, slower |
| Claude Sonnet 5 | `claude-sonnet-5` | Balanced **default** |
| Claude Haiku 4.5 | `claude-haiku-4-5` | Fastest, lightweight |

## Capability flags shape each request

Each model carries capability flags (`ModelDef`) that adapt the request:

- **`supportsThinking`** — adaptive extended thinking plus the reasoning-`effort`
  control (`low … max`). Haiku 4.5 and Claude 3.x lack it, so the effort control
  doesn't apply to them.
- **`supportsProgrammaticTools`** — Claude invoking tools from inside code
  execution. Models without it (Haiku) withhold the code interpreter and pin
  tools to `allowed_callers: ["direct"]`.
- **`maxTokens`** — output cap (8192 for Haiku, 16000 for the rest).

Two consequences worth knowing:

- Because Haiku has no extended thinking and no programmatic tool calling, the
  reasoning-effort control is inert for it and the code interpreter is withheld.
- `web_search_20260209` filters results by running code under the hood. Declared
  next to an explicit `code_execution` tool it confuses the model into writing
  code for things it should just search, so the basic `web_search_20250305` is
  used whenever code execution is also on.

## Reasoning effort

**Settings → Model** exposes a reasoning-effort control (`low`, `medium`,
`high`, `xhigh`, `max`) that overrides the model's default adaptive thinking. It
applies only to models where `supportsThinking` is true.

## LM Studio models

For LM Studio, the model list is **fetched from the server**, not hardcoded.
`fetchLmStudioModels` tries the server's APIs richest-first:

1. `/api/v1/models` — reports per-model capabilities, including reasoning
   (`capabilities.reasoning.allowed_options`).
2. `/api/v0/models` — labels each model llm/vlm/embeddings.
3. `/v1/models` (OpenAI-compatible, ids only) — the last resort; embedding
   models are told apart by name (`EMBEDDING_NAME_RE`).

Local models get **no Anthropic server tools** (web search, code interpreter).
Reasoning support comes from the catalog when known; otherwise it's assumed
false, but the `<think>`-tag demux still splits inline reasoning into the panel
for models that emit it. See [LM Studio](lm-studio.md).

## Fallback resolution

`resolveModel` synthesizes a `ModelDef` from a stored id when the catalog hasn't
loaded yet, so chat still works on first paint before the LM Studio list has
been fetched.
