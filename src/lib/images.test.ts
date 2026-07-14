import { describe, expect, it, vi } from 'vitest';
import { generateImage } from './images';

describe('generateImage', () => {
  it('rejects with AbortError without calling fetch when already aborted', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const controller = new AbortController();
    controller.abort();

    await expect(
      generateImage({ apiKey: 'k', prompt: 'a cat', signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('does not pass the abort signal to fetch, so a later abort cannot cancel an in-flight request', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: 'AAAA' }] }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const controller = new AbortController();
    const result = await generateImage({ apiKey: 'k', prompt: 'a cat', signal: controller.signal });

    expect(result.dataUrl).toBe('data:image/png;base64,AAAA');
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.signal).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
