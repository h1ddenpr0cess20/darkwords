# LM Studio (Local Models)

Darkwords can run entirely against local models served by
[LM Studio](https://lmstudio.ai), with no Anthropic or OpenAI key required for
chat. It's the same client pointed at LM Studio's Anthropic-compatible server.

## Setup

1. In LM Studio, load a chat model and start its **server** (the "Developer" /
   "Local Server" tab). The default address is `http://localhost:1234`.
2. In Darkwords, open **Settings → Model** and switch the provider to
   **LM Studio**.
3. Set the server URL if it isn't the default. Trailing slashes are trimmed
   automatically.
4. The model list is fetched from the server; pick one.

## What changes versus Anthropic

- **Model list** comes from the server, not a fixed catalog (see
  [Models & Providers](models.md)).
- **Reasoning** is detected per model from LM Studio's capabilities. Models that
  emit `<think>…</think>` inline still get split into the reasoning panel by the
  demux, even when the server doesn't advertise reasoning.
- **Attachments** are indexed and searched **locally** with an embedding model
  instead of being sent as Anthropic file blocks — see [Documents](documents.md).
- **MCP servers** are contacted **from the browser** rather than through
  Anthropic's connector — see [Tools](tools.md).
- **Anthropic-only server tools** — web search and code interpreter — are
  **unavailable**.

## Embedding model for RAG

Local document search needs an embedding model. Load one in LM Studio; Darkwords
detects embedding models in the catalog (by type, or by name via
`EMBEDDING_NAME_RE`). You can pin a specific one in **Settings → Model**
(`embeddingModelId`); blank means auto-detect.

## Tips

- If the model list is empty, make sure a model is actually **loaded** in the
  server tab — a running server with no model returns nothing.
- If Darkwords can't reach the server, check the URL and that LM Studio's server
  is started. See [Troubleshooting](troubleshooting.md).

> Note: Darkwords will not contact a local server unless you have selected the
> LM Studio provider and it is running. It never probes local ports on its own.
