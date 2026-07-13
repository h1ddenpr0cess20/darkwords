import type { ClientTool } from './types';
import type { Memory } from '../../types';

/** Manual entries are capped so a memory can't become a document. */
export const MAX_MEMORY_CHARS = 600;

/**
 * Memories the assistant keeps about the user. They are stored locally, kept to
 * a FIFO limit, and prepended to the system prompt so the model sees them on
 * every turn.
 */
export function memoryTools(api: {
  add: (text: string) => { ok: boolean; message?: string; total: number };
  forget: (keyword: string) => { ok: boolean; removed: string[] };
  list: () => Memory[];
}): ClientTool[] {
  return [
    {
      name: 'remember',
      description:
        'Store a brief memory about the user to personalise future responses. Use when the user asks you to remember something, or clearly implies they want it remembered. Do not overuse.',
      input_schema: {
        type: 'object',
        properties: {
          memory: {
            type: 'string',
            description: 'A concise memory — a few words to at most two sentences.',
          },
        },
        required: ['memory'],
      },
      run: async (input) => {
        const text = String(input.memory ?? '').trim();
        if (!text) return 'Error: no memory text given.';
        if (text.length > MAX_MEMORY_CHARS) {
          return `Error: memory too long (${text.length} chars, max ${MAX_MEMORY_CHARS}).`;
        }
        const res = api.add(text);
        if (!res.ok) return `Could not store the memory: ${res.message ?? 'unknown error'}`;
        return `Stored. The user now has ${res.total} saved memories.`;
      },
      summarize: (input) => `remembered “${String(input.memory ?? '').slice(0, 40)}”`,
    },

    {
      name: 'forget',
      description:
        'Remove previously stored memories that match a keyword. Use when the user asks you to forget something.',
      input_schema: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Keyword matched against stored memories.' },
        },
        required: ['keyword'],
      },
      run: async (input) => {
        const keyword = String(input.keyword ?? '').trim();
        if (!keyword) return 'Error: no keyword given.';
        const { removed } = api.forget(keyword);
        if (!removed.length) return `No stored memory matched "${keyword}".`;
        return `Forgot ${removed.length} memory/memories: ${removed.map((m) => `“${m}”`).join(', ')}.`;
      },
      summarize: (input) => `forgot “${String(input.keyword ?? '')}”`,
    },
  ];
}

/** The block of stored memories injected into the system prompt. */
export function memoryContext(memories: Memory[]): string {
  if (!memories.length) return '';
  const lines = memories.map((m) => `- ${m.text}`).join('\n');
  return `\n\nThings you remember about the user:\n${lines}`;
}
