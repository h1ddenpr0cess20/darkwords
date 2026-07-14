import { useRef, type ChangeEvent } from 'react';
import { useAppStore } from '../../store/useAppStore';
import styles from './SettingsPanel.module.css';

/**
 * SKILL.md instruction packages. Only each skill's name and description sit in
 * the system prompt — Claude pulls the full body in with `load_skill` when a
 * task matches, so a shelf of skills doesn't flood every request.
 */
export function SkillsPanel() {
  const skills = useAppStore((s) => s.skills);
  const importSkill = useAppStore((s) => s.importSkill);
  const toggleSkill = useAppStore((s) => s.toggleSkill);
  const removeSkill = useAppStore((s) => s.removeSkill);

  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      importSkill(file.name, await file.text());
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>SKILLS</div>
      <p className={styles.info}>
        Import a <code>SKILL.md</code> file — a package of instructions for a specific task. Claude sees each skill’s
        name and description, and loads the full text only when it needs it.
      </p>

      <input ref={fileRef} type="file" accept=".md,text/markdown" multiple hidden onChange={onFiles} />
      <div className={styles.partyActions}>
        <button className={styles.primaryBtn} onClick={() => fileRef.current?.click()}>
          Import SKILL.md
        </button>
      </div>

      <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
        INSTALLED ({skills.length})
      </div>
      {skills.length === 0 && <p className={styles.info}>No skills installed.</p>}

      {skills.map((sk) => (
        <div key={sk.id} className={styles.character}>
          <div className={styles.characterHead}>
            <span
              className={styles.characterDot}
              style={{ background: sk.enabled ? 'var(--accent)' : 'var(--text-7)' }}
            />
            <span className={styles.listTitle}>{sk.name}</span>
            <button
              className={`${styles.switch} ${sk.enabled ? styles.on : ''}`}
              onClick={() => toggleSkill(sk.id)}
              title={sk.enabled ? 'Disable' : 'Enable'}
            >
              <span className={`${styles.switchKnob} ${sk.enabled ? styles.on : ''}`} />
            </button>
            <button className={styles.characterRemove} onClick={() => removeSkill(sk.id)} title="Remove skill">
              ✕
            </button>
          </div>
          <span className={styles.toolHint}>{sk.description}</span>
        </div>
      ))}
    </div>
  );
}
