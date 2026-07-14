import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/anthropic/[...path]';

function createResponse() {
  const result: { status?: number; headers: Record<string, string>; body?: string | Uint8Array } = { headers: {} };
  const response = {
    status(statusCode: number) {
      result.status = statusCode;
      return response;
    },
    setHeader(name: string, value: string) {
      result.headers[name] = value;
      return response;
    },
    end(body?: string | Uint8Array) {
      result.body = body;
    },
  };
  return { response, result };
}

afterEach(() => vi.unstubAllGlobals());

describe('Anthropic Files proxy', () => {
  it('rejects requests outside the read-only Files API allowlist', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { response, result } = createResponse();

    await handler(
      { method: 'GET', url: '/api/anthropic/v1/messages?beta=true', headers: { 'x-api-key': 'test-key' } },
      response,
    );

    expect(result.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards an allowed file download and returns the upstream bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { response, result } = createResponse();

    await handler(
      {
        method: 'GET',
        url: '/api/anthropic/v1/files/file_abc123/content?beta=true',
        headers: { 'x-api-key': 'test-key', accept: 'application/binary' },
      },
      response,
    );

    expect(fetchMock).toHaveBeenCalledWith('https://api.anthropic.com/v1/files/file_abc123/content?beta=true', {
      headers: {
        'x-api-key': 'test-key',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'files-api-2025-04-14',
        Accept: 'application/binary',
      },
    });
    expect(result.status).toBe(200);
    expect(result.headers['Cache-Control']).toBe('private, no-store');
    expect(result.headers['Content-Type']).toBe('application/octet-stream');
    expect(result.body).toEqual(bytes);
  });
});
