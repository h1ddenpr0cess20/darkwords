import type { CSSProperties } from 'react';
import { useAppStore } from '../store/useAppStore';
import { DEFAULT_PERSONALITY_NAME } from '../lib/prompt';
import type { Conversation, PromptMode } from '../types';
import type { PartyConfig } from '../lib/party/types';
import { ExportMenu } from './ExportMenu';
import styles from './TopStrip.module.css';

function personaLabel(opts: {
  party: PartyConfig | null;
  promptMode: PromptMode;
  personalityName: string;
  customPrompt: string;
  conversation: Conversation;
}): string | null {
  const { party, promptMode, personalityName, customPrompt } = opts;
  if (party) {
    const { conversationType, topic, setting, mood } = party.scenario;
    const bits = [conversationType, topic, setting, mood].map((x) => x.trim()).filter(Boolean);
    return bits.length ? `Party — ${bits.join(' · ')}` : 'Party';
  }
  if (promptMode === 'none') return 'No persona';
  if (promptMode === 'custom') return customPrompt.trim() || 'Custom prompt';
  return personalityName.trim() || DEFAULT_PERSONALITY_NAME;
}

/**
 * The conversation header: title, turn count, and the party cast chips. In
 * ordinary chat a turn is one user→assistant exchange, so user messages are
 * counted; in a party every spoken message is its own turn.
 */
export function TopStrip() {
  const conversation = useAppStore((s) => s.conversations[s.activeConvoId]);
  const party = useAppStore((s) => s.activeParty);
  const promptMode = useAppStore((s) => s.promptMode);
  const personalityName = useAppStore((s) => s.personalityName);
  const customPrompt = useAppStore((s) => s.customPrompt);
  const fontScale = useAppStore((s) => s.fontScale);
  const setFontScale = useAppStore((s) => s.setFontScale);

  if (!conversation) return null;

  const turns = conversation.messages.filter((m) => !m.error && (party || m.role === 'user')).length;
  const persona = personaLabel({ party, promptMode, personalityName, customPrompt, conversation });

  return (
    <div className={styles.strip}>
      <h1 className={styles.title}>{conversation.title}</h1>
      <span className={styles.turns}>
        {turns} {turns === 1 ? 'turn' : 'turns'}
      </span>
      {persona && <span className={styles.persona} title={persona}>{persona}</span>}
      <div className={styles.spacer} />

      <button
        className={styles.fontBtn}
        onClick={() => setFontScale(fontScale - 0.1)}
        disabled={fontScale <= 0.8}
        title="Smaller text"
      >
        A−
      </button>
      <button
        className={styles.fontBtnLarge}
        onClick={() => setFontScale(fontScale + 0.1)}
        disabled={fontScale >= 1.6}
        title="Larger text"
      >
        A+
      </button>

      <ExportMenu />

      {party && (
        <div className={styles.chips}>
          {party.characters.map((c) => {
            const vars = {
              '--chip-bg': `${c.color}1a`,
              '--chip-border': `${c.color}55`,
              '--chip-avatar-bg': `${c.color}30`,
              '--chip-color': c.color,
            } as CSSProperties;
            return (
              <div key={c.id} className={styles.chip} style={vars} title={c.persona}>
                <span className={styles.chipAvatar}>{(c.name[0] ?? '?').toUpperCase()}</span>
                <span className={styles.chipName}>{c.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
