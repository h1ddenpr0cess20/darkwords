import type { ModelDef, Provider } from '../types';
import { EMBEDDING_NAME_RE } from './rag/embeddings';

export const DEFAULT_LM_STUDIO_URL = 'http://localhost:1234';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

function shortLabel(name: string): string {
  const family = name.match(/opus|sonnet|haiku|fable|mythos/i)?.[0];
  return (family?.[0] || name.replace(/^claude[- ]?/i, '')[0] || 'C').toUpperCase();
}

/**
 * Capability heuristics from the model id. Haiku and Claude 3.x lack adaptive
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

/** The Anthropic catalog is fixed; only LM Studio's is fetched from a server. */
export const ANTHROPIC_MODELS: ModelDef[] = [
  {
    id: 'claude-fable-5',
    apiModel: 'claude-fable-5',
    name: 'Claude Fable 5',
    short: 'F',
    blurb: 'Most intelligent, Mythos-class',
    supportsThinking: true,
    supportsProgrammaticTools: true,
    maxTokens: 16000,
  },
  {
    id: 'claude-opus-4-8',
    apiModel: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    short: 'O',
    blurb: 'Most capable Opus, slower',
    supportsThinking: true,
    supportsProgrammaticTools: true,
    maxTokens: 16000,
  },
  {
    id: 'claude-sonnet-5',
    apiModel: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    short: 'S',
    blurb: 'Balanced default',
    supportsThinking: true,
    supportsProgrammaticTools: true,
    maxTokens: 16000,
  },
  {
    id: 'claude-haiku-4-5',
    apiModel: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    short: 'H',
    blurb: 'Fastest, lightweight',
    supportsThinking: false,
    supportsProgrammaticTools: false,
    maxTokens: 8192,
  },
];

/**
 * Local models get no Anthropic server tools. Reasoning support comes from
 * LM Studio's model catalog (`capabilities.reasoning`); when unknown we assume
 * false, but the `<think>`-tag demux still catches models that emit reasoning
 * inline in the text.
 */
export function lmStudioModelDef(id: string, blurb = 'local model', supportsThinking = false): ModelDef {
  return {
    id,
    apiModel: id,
    name: id,
    short: (id.replace(/^[^a-z0-9]*/i, '')[0] || 'L').toUpperCase(),
    blurb,
    supportsThinking,
    supportsProgrammaticTools: false,
    maxTokens: 4096,
  };
}

/** The chat models plus, for LM Studio, the embedding models available for RAG. */
export interface ModelCatalog {
  chat: ModelDef[];
  embeddings: string[];
}

interface LmStudioV0Model {
  id: string;
  type?: string;
  arch?: string;
  state?: string;
  publisher?: string;
}

interface LmStudioV1Model {
  key: string;
  type?: string;
  architecture?: string;
  params_string?: string;
  loaded_instances?: unknown[];
  capabilities?: {
    reasoning?: { allowed_options?: string[]; default?: string };
  };
}

export async function fetchLmStudioModels(baseUrl: string): Promise<ModelCatalog> {
  const base = baseUrl.replace(/\/+$/, '');

  // /api/v1/models reports per-model capabilities, including whether the model
  // can reason; /api/v0/models labels each model llm/vlm/embeddings; the
  // OpenAI-compatible /v1/models (ids only) is the last resort.
  try {
    const res = await fetch(`${base}/api/v1/models`);
    if (res.ok) {
      const data = (await res.json()) as { models?: LmStudioV1Model[] };
      const models = data.models ?? [];
      if (models.length) {
        const isEmbedding = (m: LmStudioV1Model) =>
          m.type === 'embedding' || m.type === 'embeddings' || EMBEDDING_NAME_RE.test(m.key);
        const chat = models
          .filter((m) => !isEmbedding(m))
          .map((m) =>
            lmStudioModelDef(
              m.key,
              [m.architecture, m.params_string, m.loaded_instances?.length ? 'loaded' : null]
                .filter(Boolean)
                .join(' — ') || 'local model',
              m.capabilities?.reasoning?.allowed_options?.includes('on') ?? false,
            ),
          );
        const embeddings = models.filter(isEmbedding).map((m) => m.key);
        return { chat, embeddings };
      }
    }
  } catch {
    // fall through to /api/v0/models
  }

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
