import { useAppStore } from '../store/useAppStore';
import { THEMES } from './config';
import { hexToRgb } from './color';

export function useAccent(): { accent: string; accentBg: string } {
  const themeId = useAppStore((s) => s.themeId);
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  return { accent: theme.color, accentBg: `rgba(${hexToRgb(theme.color)}, 0.14)` };
}
