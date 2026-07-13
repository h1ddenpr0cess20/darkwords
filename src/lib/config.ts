import type { ModelDef, ThemeDef } from '../types';

export const MODELS: ModelDef[] = [
  {
    id: 'opus',
    apiModel: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    short: 'O',
    blurb: 'Most capable, slower',
    supportsThinking: true,
    supportsProgrammaticTools: true,
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
    supportsProgrammaticTools: true,
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
    supportsProgrammaticTools: false,
    maxTokens: 8192,
    effort: 'low',
  },
];

export const THEMES: ThemeDef[] = [
  { id: 'ink', color: '#7EE787', label: 'Ink' },
  { id: 'ember', color: '#E8B54D', label: 'Ember' },
  { id: 'dusk', color: '#8FB9FF', label: 'Dusk' },
];
