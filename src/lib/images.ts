/**
 * Image generation via OpenAI's Images API (gpt-image-2).
 *
 * Anthropic's API has no image-generation endpoint, so `generate_image` is a
 * client-side tool: Claude calls it, and we fulfil the call against an external
 * image generator, then hand the result back as the tool result.
 */

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

export const IMAGE_MODEL = 'gpt-image-2';

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024';

export interface GeneratedImage {
  /** base64 data URL, directly renderable in an <img> */
  dataUrl: string;
  /** the prompt the image model actually used, when it reports one back */
  revisedPrompt?: string;
}

interface OpenAIImageResponse {
  data?: { b64_json?: string; url?: string; revised_prompt?: string }[];
  error?: { message?: string };
}

/** Thrown for any failure the model should be told about verbatim. */
export class ImageGenError extends Error {}

export async function generateImage(opts: {
  apiKey: string;
  prompt: string;
  size?: ImageSize;
  signal?: AbortSignal;
}): Promise<GeneratedImage> {
  const { apiKey, prompt, size = '1024x1024', signal } = opts;

  if (!apiKey) {
    throw new ImageGenError(
      'No OpenAI API key is configured. The user must add one in Settings → API Key before images can be generated.',
    );
  }

  let res: Response;
  try {
    res = await fetch(OPENAI_IMAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, size }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ImageGenError(`Could not reach the image API: ${err instanceof Error ? err.message : String(err)}`);
  }

  let body: OpenAIImageResponse;
  try {
    body = (await res.json()) as OpenAIImageResponse;
  } catch {
    throw new ImageGenError(`Image API returned a non-JSON response (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    throw new ImageGenError(body.error?.message ?? `Image API error (HTTP ${res.status}).`);
  }

  const first = body.data?.[0];
  if (!first) throw new ImageGenError('Image API returned no image.');

  // gpt-image models return base64 by default; fall back to a URL if one is sent.
  if (first.b64_json) {
    return { dataUrl: `data:image/png;base64,${first.b64_json}`, revisedPrompt: first.revised_prompt };
  }
  if (first.url) {
    return { dataUrl: first.url, revisedPrompt: first.revised_prompt };
  }
  throw new ImageGenError('Image API response contained neither image data nor a URL.');
}
