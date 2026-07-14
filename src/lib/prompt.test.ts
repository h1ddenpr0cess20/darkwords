import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, DEFAULT_PERSONALITY_NAME } from './prompt';

const base = { personalityName: 'a grumpy pirate', customPrompt: 'be terse', verbose: false };

describe('buildSystemPrompt', () => {
  it('returns empty for mode none', () => {
    expect(buildSystemPrompt({ ...base, mode: 'none' })).toBe('');
  });

  it('returns the trimmed custom prompt verbatim for mode custom', () => {
    expect(buildSystemPrompt({ ...base, mode: 'custom', customPrompt: '  be terse  ' })).toBe('be terse');
  });

  it('wraps the personality name in the roleplay instruction', () => {
    const prompt = buildSystemPrompt({ ...base, mode: 'personality' });
    expect(prompt).toContain('a grumpy pirate');
    expect(prompt).toContain('never break character');
  });

  it('falls back to the default personality when the name is blank', () => {
    const prompt = buildSystemPrompt({ ...base, mode: 'personality', personalityName: '   ' });
    expect(prompt).toContain(DEFAULT_PERSONALITY_NAME);
  });

  it('appends the brevity guideline only when not verbose', () => {
    expect(buildSystemPrompt({ ...base, mode: 'personality' })).toContain('relatively short');
    expect(buildSystemPrompt({ ...base, mode: 'personality', verbose: true })).not.toContain('relatively short');
  });
});
