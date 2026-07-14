import type { ModelDef, Provider } from '../types';
import { EMBEDDING_NAME_RE } from './rag/embeddings';

export const ANTHROPIC_VERSION = '2023-06-01';
export const DEFAULT_LM_STUDIO_URL = 'http://localhost:1234';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';

function shortLabel(name: string): string {
  const family = name.match(/opus|sonnet|haiku|fable|mythos/i)?.[0];
  return (family?.[0] || name.replace(/^claude[- ]?/i, '')[0] || 'C').toUpperCase();
}

/**
 * Capability heuristics from the model id — the models endpoint reports
 * nothing beyond id and display name. Haiku and Claude 3.x lack adaptive
 * thinking and programmatic tool calling.
 */
export function anthropicModelDef(id: string, displayName?: string): ModelDef {
  const limited = /haiku|claude-3[.-]/i.test(id);
  return {
    id,
    apiModel: id,
    name: displayName || id,
    short: shortLabel(displayName || id),
    blurb: id,
    supportsThinking: !limited,
    supportsProgrammaticTools: !limited,
    maxTokens: /haiku/i.test(id) ? 8192 : 16000,
  };
}

/**
 * Local models get no Anthropic server tools and no thinking request params —
 * reasoning models emit `<think>` spans inline, which the stream demuxes into
 * the thinking callback instead.
 */
export function lmStudioModelDef(id: string, blurb = 'local model'): ModelDef {
  return {
    id,
    apiModel: id,
    name: id,
    short: (id.replace(/^[^a-z0-9]*/i, '')[0] || 'L').toUpperCase(),
    blurb,
    supportsThinking: false,
    supportsProgrammaticTools: false,
    maxTokens: 4096,
  };
}

/** The chat models plus, for LM Studio, the embedding models available for RAG. */
export interface ModelCatalog {
  chat: ModelDef[];
  embeddings: string[];
}

export async function fetchAnthropicModels(apiKey: string): Promise<ModelCatalog> {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
  if (!res.ok) throw new Error(`Model list failed: HTTP ${res.status}`);
  const data = (await res.json()) as { data?: { id: string; display_name?: string }[] };
  const chat = (data.data ?? []).map((m) => anthropicModelDef(m.id, m.display_name));
  if (!chat.length) throw new Error('Model list came back empty');
  return { chat, embeddings: [] };
}

interface LmStudioV0Model {
  id: string;
  type?: string;
  arch?: string;
  state?: string;
  publisher?: string;
}

export async function fetchLmStudioModels(baseUrl: string): Promise<ModelCatalog> {
  const base = baseUrl.replace(/\/+$/, '');

  // /api/v0/models labels each model llm/vlm/embeddings; fall back to the
  // OpenAI-compatible /v1/models (ids only) on older versions.
  try {
    const res = await fetch(`${base}/api/v0/models`);
    if (res.ok) {
      const data = (await res.json()) as { data?: LmStudioV0Model[] };
      const models = data.data ?? [];
      if (models.length) {
        const chat = models
          .filter((m) => m.type !== 'embeddings' && !EMBEDDING_NAME_RE.test(m.id))
          .map((m) =>
            lmStudioModelDef(m.id, [m.arch, m.state === 'loaded' ? 'loaded' : null].filter(Boolean).join(' — ') || 'local model'),
          );
        const embeddings = models.filter((m) => m.type === 'embeddings').map((m) => m.id);
        return { chat, embeddings };
      }
    }
  } catch {
    // fall through to /v1/models
  }

  const res = await fetch(`${base}/v1/models`);
  if (!res.ok) throw new Error(`LM Studio not reachable at ${base} (HTTP ${res.status})`);
  const data = (await res.json()) as { data?: { id: string }[] };
  const ids = (data.data ?? []).map((m) => m.id);
  if (!ids.length) throw new Error('LM Studio returned no models — load one in the server tab');
  return {
    chat: ids.filter((id) => !EMBEDDING_NAME_RE.test(id)).map((id) => lmStudioModelDef(id)),
    embeddings: ids.filter((id) => EMBEDDING_NAME_RE.test(id)),
  };
}

/**
 * The model to send a turn with. Falls back to a def synthesized from the
 * stored id so chat still works before the model list has been fetched.
 */
export function resolveModel(provider: Provider, id: string, catalog: ModelDef[]): ModelDef {
  const found = catalog.find((m) => m.id === id);
  if (found) return found;
  return provider === 'lmstudio'
    ? lmStudioModelDef(id || 'local-model')
    : anthropicModelDef(id || DEFAULT_ANTHROPIC_MODEL);
}
