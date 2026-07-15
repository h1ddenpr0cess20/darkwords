# Security

Read this before deploying Darkwords anywhere other than your own machine.

## The trust model

Darkwords has **no backend**. Your API keys are:

- **Stored client-side** — in this browser's IndexedDB (see [Storage](storage.md)).
- **Sent directly to the providers** — `api.anthropic.com`, `api.openai.com`, or
  your own LM Studio server.

This is fine for **local, single-user use**. It is *not* fine for a shared
deployment: any code served from that origin (including a compromised
dependency) can read the keys the user entered there.

## Before deploying somewhere shared

- Put the provider calls behind a **backend proxy** that holds the keys server
  side, or
- Restrict the deployment to trusted users only, and treat the keys as shared.

## What protects keys today

- **Exports exclude keys.** `Settings → Data` exports everything *except* the
  API keys, so an export is safe to back up or share without leaking credentials.
- **The Anthropic proxy rewrite** (`vercel.json`, `/anthropic/:path*`) keeps
  requests same-origin to satisfy browser CORS — it is a routing convenience,
  **not** a key-hiding measure. The key still travels from the browser.

## Data handling

- Prompts and outputs are transmitted to whichever provider you configure.
  Darkwords does not control provider logging or retention — review each
  provider's privacy policy.
- Attached documents on LM Studio are parsed and embedded **locally**; nothing
  leaves the browser for the embedding step beyond the call to your own LM Studio
  server (see [Documents](documents.md)).
- Voice playback sends finished reply text to OpenAI for synthesis (see
  [Voice](voice.md)).

## Related

- [AI Output Disclaimer and Conditions of Use](ai-output-disclaimer.md)
- [Storage](storage.md)
- [Deployment](deployment.md)
