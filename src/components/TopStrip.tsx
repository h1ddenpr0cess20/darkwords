import type { CSSProperties } from 'react';
import { useAppStore } from '../store/useAppStore';
import styles from './TopStrip.module.css';

/**
 * The conversation header: title, turn count, and the party cast chips. In
 * ordinary chat a turn is one user→assistant exchange, so user messages are
 * counted; in a party every spoken message is its own turn.
 */
export function TopStrip() {
  const conversation = useAppStore((s) => s.conversations[s.activeConvoId]);
  const party = useAppStore((s) => s.activeParty);

  if (!conversation) return null;

  const turns = conversation.messages.filter((m) => !m.error && (party || m.role === 'user')).length;

  return (
    <div className={styles.strip}>
      <h1 className={styles.title}>{conversation.title}</h1>
      <span className={styles.turns}>
        {turns} {turns === 1 ? 'turn' : 'turns'}
      </span>
      <div className={styles.spacer} />

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
