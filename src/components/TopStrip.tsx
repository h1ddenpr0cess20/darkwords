import type { CSSProperties } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PERSONA_POOL } from '../lib/config';
import styles from './TopStrip.module.css';

export function TopStrip() {
  const conversation = useAppStore((s) => s.conversations[s.activeConvoId]);
  const partyMode = useAppStore((s) => s.partyMode);
  const activePersonaIds = useAppStore((s) => s.activePersonaIds);
  const removePersona = useAppStore((s) => s.removePersona);
  const addPersona = useAppStore((s) => s.addPersona);

  const canAddPersona = activePersonaIds.length < PERSONA_POOL.length;

  return (
    <div className={styles.strip}>
      <h1 className={styles.title}>{conversation.title}</h1>
      <span className={styles.turns}>{conversation.messages.length} turns</span>
      <div className={styles.spacer} />
      {partyMode && (
        <div className={styles.chips}>
          {activePersonaIds.map((id) => {
            const p = PERSONA_POOL.find((pp) => pp.id === id);
            if (!p) return null;
            const vars = {
              '--chip-bg': `${p.color}1a`,
              '--chip-border': `${p.color}55`,
              '--chip-avatar-bg': `${p.color}30`,
              '--chip-color': p.color,
            } as CSSProperties;
            return (
              <div key={id} className={styles.chip} style={vars}>
                <span className={styles.chipAvatar}>{p.initial}</span>
                <span className={styles.chipName}>{p.name}</span>
                <button className={styles.chipRemove} title={`Remove ${p.name}`} onClick={() => removePersona(id)}>
                  ✕
                </button>
              </div>
            );
          })}
          {canAddPersona && (
            <button className={styles.addChip} onClick={addPersona}>
              + character
            </button>
          )}
        </div>
      )}
    </div>
  );
}
