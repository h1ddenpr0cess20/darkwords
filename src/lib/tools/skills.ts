import type { ClientTool } from './types';
import type { Skill } from '../../types';

/**
 * Skills are SKILL.md instruction packages. Only each skill's name and
 * description sit in the system prompt; the model pulls the full body in on
 * demand via `load_skill`. That progressive disclosure is the point — a dozen
 * skills would otherwise flood every request.
 */
export function skillTool(skills: Skill[]): ClientTool | null {
  const enabled = skills.filter((s) => s.enabled);
  if (!enabled.length) return null;

  return {
    name: 'load_skill',
    description:
      'Load the full instructions for one of the available skills. Call this as soon as a task matches a skill, before starting the work.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the skill to load.',
          enum: enabled.map((s) => s.name),
        },
      },
      required: ['name'],
    },
    run: async (input) => {
      const name = String(input.name ?? '').trim().toLowerCase();
      const skill = enabled.find((s) => s.name.toLowerCase() === name);
      if (!skill) return `Error: no skill named "${input.name}".`;
      return `--- SKILL: ${skill.name} ---\n${skill.content}`;
    },
    summarize: (input) => `loaded skill “${String(input.name ?? '')}”`,
  };
}

/** The catalogue of available skills advertised in the system prompt. */
export function skillsContext(skills: Skill[]): string {
  const enabled = skills.filter((s) => s.enabled);
  if (!enabled.length) return '';
  const lines = enabled.map((s) => `- ${s.name}: ${s.description}`).join('\n');
  return `\n\nAvailable skills (call load_skill to read one in full before using it):\n${lines}`;
}

/**
 * Parses a SKILL.md file. Supports YAML-ish frontmatter with `name` and
 * `description`; falls back to the filename and the first non-empty line.
 */
export function parseSkill(fileName: string, source: string): { name: string; description: string; content: string } {
  const fallbackName = fileName.replace(/\.md$/i, '').replace(/[-_]/g, ' ').trim() || 'skill';

  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  let name = '';
  let description = '';
  let body = source;

  if (frontmatter) {
    body = source.slice(frontmatter[0].length);
    for (const line of frontmatter[1].split(/\r?\n/)) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (match[1] === 'name') name = value;
      if (match[1] === 'description') description = value;
    }
  }

  if (!name) {
    const heading = body.match(/^#\s+(.+)$/m);
    name = heading ? heading[1].trim() : fallbackName;
  }
  if (!description) {
    const firstLine = body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'));
    description = firstLine ? firstLine.slice(0, 200) : 'No description provided.';
  }

  return { name, description, content: body.trim() };
}
