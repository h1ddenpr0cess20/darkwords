import { describe, expect, it, vi } from 'vitest';
import { buildTtsInstructions, generateSpeech, isSpeakable, TtsError } from './tts';

describe('isSpeakable', () => {
  it('is false for empty or whitespace-only text', () => {
    expect(isSpeakable('')).toBe(false);
    expect(isSpeakable('   \n ')).toBe(false);
  });

  it('is false for text containing a fenced code block', () => {
    expect(isSpeakable('here you go:\n```js\nconsole.log(1)\n```')).toBe(false);
  });

  it('is true for ordinary prose', () => {
    expect(isSpeakable('Fine. Here is your answer.')).toBe(true);
  });
});

describe('buildTtsInstructions', () => {
  it('prefers an explicit instruction override, trimmed', () => {
    const out = buildTtsInstructions({
      instructions: '  Speak like a robot  ',
      promptMode: 'personality',
      personalityName: 'a pirate',
    });
    expect(out).toBe('Speak like a robot');
  });

  it('derives from the personality when no override and a personality is active', () => {
    const out = buildTtsInstructions({ instructions: '', promptMode: 'personality', personalityName: 'a pirate' });
    expect(out).toContain('Assume the personality of a pirate.');
    expect(out).toContain('Do not read code blocks');
  });

  it('ignores a blank personality name and falls back to the neutral tone', () => {
    const out = buildTtsInstructions({ instructions: '', promptMode: 'personality', personalityName: '   ' });
    expect(out).toBe('Speak in a natural, conversational tone.');
  });

  it('uses the neutral tone when the persona is not a personality prompt', () => {
    expect(buildTtsInstructions({ instructions: '', promptMode: 'custom', personalityName: 'a pirate' })).toBe(
      'Speak in a natural, conversational tone.',
    );
    expect(buildTtsInstructions({ instructions: '', promptMode: 'none', personalityName: 'a pirate' })).toBe(
      'Speak in a natural, conversational tone.',
    );
  });
});

describe('generateSpeech', () => {
  it('throws a TtsError without calling fetch when no key is set', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(generateSpeech({ apiKey: '', text: 'hi', voice: 'ash' })).rejects.toBeInstanceOf(TtsError);
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('posts the model, input, voice, instructions, and WAV format, returning the audio bytes', async () => {
    const bytes = new ArrayBuffer(8);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes });
    vi.stubGlobal('fetch', fetchSpy);

    const out = await generateSpeech({ apiKey: 'k', text: 'hello', voice: 'nova', instructions: 'be calm' });
    expect(out).toBe(bytes);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    expect(init.headers.authorization).toBe('Bearer k');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'gpt-4o-mini-tts',
      input: 'hello',
      voice: 'nova',
      instructions: 'be calm',
      response_format: 'wav',
    });

    vi.unstubAllGlobals();
  });

  it('surfaces the API error message on a non-ok response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'bad key' } }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(generateSpeech({ apiKey: 'k', text: 'hi', voice: 'ash' })).rejects.toThrow(/bad key/);

    vi.unstubAllGlobals();
  });

  it('falls back to the status line when the error body is not JSON', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => {
        throw new Error('not json');
      },
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(generateSpeech({ apiKey: 'k', text: 'hi', voice: 'ash' })).rejects.toThrow(/HTTP 500/);

    vi.unstubAllGlobals();
  });

  it('re-throws an AbortError as-is rather than wrapping it', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(generateSpeech({ apiKey: 'k', text: 'hi', voice: 'ash' })).rejects.toMatchObject({
      name: 'AbortError',
    });

    vi.unstubAllGlobals();
  });
});
