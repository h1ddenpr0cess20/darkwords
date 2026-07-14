import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANTHROPIC_MODELS,
  DEFAULT_ANTHROPIC_MODEL,
  fetchLmStudioModels,
  lmStudioModelDef,
  resolveModel,
} from './models';

function mockFetchRoutes(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      for (const [path, body] of Object.entries(routes)) {
        if (url.endsWith(path)) {
          if (body === undefined) return { ok: false, status: 404 } as Response;
          return { ok: true, json: async () => body } as Response;
        }
      }
      throw new TypeError('fetch failed');
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('resolveModel', () => {
  it('returns the catalog entry when the id is known', () => {
    const sonnet = resolveModel('anthropic', 'claude-sonnet-5', ANTHROPIC_MODELS);
    expect(sonnet.name).toBe('Claude Sonnet 5');
  });

  it('synthesizes a def for an unknown id so chat still works', () => {
    const local = resolveModel('lmstudio', 'mystery-model', []);
    expect(local.apiModel).toBe('mystery-model');
    expect(local.supportsThinking).toBe(false);

    const claude = resolveModel('anthropic', 'claude-future-9', ANTHROPIC_MODELS);
    expect(claude.apiModel).toBe('claude-future-9');
  });

  it('falls back to defaults for an empty id', () => {
    expect(resolveModel('anthropic', '', ANTHROPIC_MODELS).id).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(resolveModel('lmstudio', '', []).id).toBe('local-model');
  });
});

describe('lmStudioModelDef', () => {
  it('defaults to no thinking support', () => {
    expect(lmStudioModelDef('m').supportsThinking).toBe(false);
    expect(lmStudioModelDef('m', 'blurb', true).supportsThinking).toBe(true);
  });
});

describe('fetchLmStudioModels', () => {
  it('reads /api/v1/models, detecting reasoning capability and separating embeddings', async () => {
    mockFetchRoutes({
      '/api/v1/models': {
        models: [
          {
            key: 'reasoner',
            type: 'llm',
            architecture: 'qwen3',
            capabilities: { reasoning: { allowed_options: ['off', 'on'], default: 'on' } },
          },
          { key: 'plain', type: 'llm' },
          { key: 'embedder', type: 'embedding' },
          { key: 'text-embedding-foo', type: 'llm' },
        ],
      },
    });

    const catalog = await fetchLmStudioModels('http://localhost:1234');
    expect(catalog.chat.map((m) => m.id)).toEqual(['reasoner', 'plain']);
    expect(catalog.chat[0].supportsThinking).toBe(true);
    expect(catalog.chat[1].supportsThinking).toBe(false);
    expect(catalog.embeddings).toEqual(['embedder', 'text-embedding-foo']);
  });

  it('falls back to /api/v0/models when v1 is unavailable', async () => {
    mockFetchRoutes({
      '/api/v1/models': undefined,
      '/api/v0/models': {
        data: [
          { id: 'chatty', type: 'llm', arch: 'llama', state: 'loaded' },
          { id: 'embedder', type: 'embeddings' },
        ],
      },
    });

    const catalog = await fetchLmStudioModels('http://localhost:1234');
    expect(catalog.chat.map((m) => m.id)).toEqual(['chatty']);
    expect(catalog.chat[0].blurb).toBe('llama — loaded');
    expect(catalog.embeddings).toEqual(['embedder']);
  });

  it('falls back to the OpenAI-compatible /v1/models as a last resort', async () => {
    mockFetchRoutes({
      '/api/v1/models': undefined,
      '/api/v0/models': undefined,
      '/v1/models': { data: [{ id: 'legacy' }, { id: 'text-embedding-old' }] },
    });

    const catalog = await fetchLmStudioModels('http://localhost:1234');
    expect(catalog.chat.map((m) => m.id)).toEqual(['legacy']);
    expect(catalog.embeddings).toEqual(['text-embedding-old']);
  });

  it('strips trailing slashes from the base url', async () => {
    mockFetchRoutes({ '/api/v1/models': { models: [{ key: 'm', type: 'llm' }] } });
    await fetchLmStudioModels('http://localhost:1234///');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://localhost:1234/api/v1/models');
  });

  it('throws when the server returns no models at all', async () => {
    mockFetchRoutes({ '/api/v1/models': undefined, '/api/v0/models': undefined, '/v1/models': { data: [] } });
    await expect(fetchLmStudioModels('http://localhost:1234')).rejects.toThrow(/no models/);
  });
});
