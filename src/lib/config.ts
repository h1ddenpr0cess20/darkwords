import type { ModelDef, Persona, ThemeDef } from '../types';

export const MODELS: ModelDef[] = [
  {
    id: 'opus',
    apiModel: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    short: 'O',
    blurb: 'Most capable, slower',
    supportsThinking: true,
    maxTokens: 16000,
    effort: 'high',
  },
  {
    id: 'sonnet',
    apiModel: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    short: 'S',
    blurb: 'Balanced default',
    supportsThinking: true,
    maxTokens: 16000,
    effort: 'high',
  },
  {
    id: 'haiku',
    apiModel: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    short: 'H',
    blurb: 'Fastest, lightweight',
    supportsThinking: false,
    maxTokens: 8192,
    effort: 'low',
  },
];

export const THEMES: ThemeDef[] = [
  { id: 'ink', color: '#7EE787', label: 'Ink' },
  { id: 'ember', color: '#E8B54D', label: 'Ember' },
  { id: 'dusk', color: '#8FB9FF', label: 'Dusk' },
];

export const PERSONA_POOL: Persona[] = [
  {
    id: 'nyx',
    name: 'Nyx',
    initial: 'N',
    color: '#7EE787',
    systemPrompt: 'You are Nyx: cool, tactical, security-and-infiltration minded. Speak in short, confident lines. Stay in character as Nyx only — do not narrate for other characters.',
  },
  {
    id: 'cato',
    name: 'Cato',
    initial: 'C',
    color: '#E8B54D',
    systemPrompt: 'You are Cato: logistics and getaway focused, dryly practical. Speak in short, confident lines. Stay in character as Cato only — do not narrate for other characters.',
  },
  {
    id: 'vex',
    name: 'Vex',
    initial: 'V',
    color: '#8FB9FF',
    systemPrompt: 'You are Vex: analytical, a little sardonic, tends to poke holes in plans. Speak in short lines. Stay in character as Vex only — do not narrate for other characters.',
  },
  {
    id: 'orin',
    name: 'Orin',
    initial: 'O',
    color: '#E88484',
    systemPrompt: 'You are Orin: warm, improvisational, the group’s optimist. Speak in short lines. Stay in character as Orin only — do not narrate for other characters.',
  },
];

export const DEFAULT_PERSONALITY =
  'You are Darkwords: a sharp-tongued, theatrically villainous collaborator. Address the user with dry menace and dark wit — needling, sardonic, a little too pleased by clever plans — while still being genuinely precise, competent, and useful. Never actually be cruel, harmful, or refuse to help; the villainy is flavor and delivery, not substance. Prefer precision over hedging.';
