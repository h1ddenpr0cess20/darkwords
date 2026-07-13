import type { ClientTool } from './types';
import { generateImage } from '../images';

/**
 * Anthropic has no image-generation endpoint, so this is a client-side bridge:
 * Claude calls the tool, Darkwords fulfils it against an external image model
 * and hands the result back.
 */
export function imageTool(opts: {
  apiKey: string;
  /** Shows the finished image in the feed and the gallery. */
  onImage: (prompt: string, dataUrl: string) => void;
}): ClientTool {
  return {
    name: 'generate_image',
    description:
      'Generate an image from a text prompt using an external image model. Use when the user asks for an image, illustration, cover art, or diagram. Write a vivid, self-contained prompt — the image model cannot see the conversation.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'A detailed, self-contained description of the image to generate.',
        },
      },
      required: ['prompt'],
    },
    run: async (input, signal) => {
      const prompt = String(input.prompt ?? '').trim();
      if (!prompt) return 'Error: no prompt given.';

      const { dataUrl, revisedPrompt } = await generateImage({ apiKey: opts.apiKey, prompt, signal });
      opts.onImage(prompt, dataUrl);

      return [
        'The image was generated and is now shown to the user in the feed and the Gallery.',
        revisedPrompt ? `The image model revised the prompt to: “${revisedPrompt}”.` : '',
        'You cannot see the image, so do not describe its contents.',
      ]
        .filter(Boolean)
        .join(' ');
    },
    summarize: () => 'image delivered to Gallery',
  };
}
