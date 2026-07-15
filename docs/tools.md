# Tools

Claude can call tools during a turn. Some run on Anthropic's servers; others are
**client-side** — fulfilled in your browser and fed back into the tool loop.
Global toggles live in **Settings → Tools** (`toolsEnabled`).

| Tool | Runs where | Enabled by |
| --- | --- | --- |
| Web search | Anthropic's servers (Anthropic only) | `toolsEnabled.web` |
| Code interpreter | Anthropic's servers, sandboxed Python (Anthropic only) | `toolsEnabled.code` |
| Image generation | Your browser → OpenAI `gpt-image-2` | `toolsEnabled.image` + OpenAI key |
| Memory (`remember` / `forget`) | Your browser | Settings → Memory |
| Skills (`load_skill`) | Your browser | Settings → Skills |
| MCP servers | Anthropic's MCP connector, or your browser on LM Studio | Settings → Tools |
| Document search (RAG) | Your browser, with an LM Studio embedding model | attaching documents |

## Server-side tools (Anthropic only)

**Web search** and **code interpreter** run on Anthropic's infrastructure. They
are unavailable with LM Studio. Note the web-search version-selection quirk: the
dynamic-filtering `web_search_20260209` runs code under the hood, so when code
execution is also on, Darkwords falls back to the plain `web_search_20250305` to
stop the model writing code for things it should just search. Haiku 4.5 has no
programmatic tool calling, so the code interpreter is withheld for it.

## Image generation (client-side)

Anthropic has no image-generation endpoint, so `generate_image` is a client-side
tool. Claude calls it, Darkwords fulfils the call against OpenAI's `gpt-image-2`
(`src/lib/images.ts`), and the result returns as a tool result — landing in the
feed and the Gallery. With no OpenAI key set, the tool isn't offered to the model
at all. Image generation works regardless of chat provider (Anthropic or LM
Studio) as long as an OpenAI key is present.

## Memory

The `remember` and `forget` tools let Claude keep brief facts about you. See
[Memory](memory.md).

## Skills

`load_skill` pulls the full body of a `SKILL.md` package into context on demand.
See [Skills](skills.md).

## MCP servers

Add remote [Model Context Protocol](https://modelcontextprotocol.io) servers in
**Settings → Tools**. On **Anthropic**, they're reached through Anthropic's MCP
connector. On **LM Studio**, they're contacted **from the browser**
(`src/lib/tools/mcpClient.ts`). Each server has a name, URL, optional auth token,
and an enabled flag.

## Document search (RAG)

Attached documents can be searched locally instead of uploaded. See
[Documents & Attachments](documents.md).
