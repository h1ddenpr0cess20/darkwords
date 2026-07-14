import { useAppStore } from '../../../store/useAppStore';
import { PartyForm } from '../PartyForm';
import { PERSONA_PRESETS } from '../../../lib/personas';
import type { PromptMode } from '../../../types';
import styles from '../SettingsPanel.module.css';

const PROMPT_MODES: { key: PromptMode; label: string }[] = [
  { key: 'personality', label: 'Personality' },
  { key: 'custom', label: 'Custom' },
  { key: 'none', label: 'None' },
  { key: 'party', label: 'Party' },
];

export function PersonalityTab() {
  const promptMode = useAppStore((s) => s.promptMode);
  const setPromptMode = useAppStore((s) => s.setPromptMode);
  const personalityName = useAppStore((s) => s.personalityName);
  const setPersonalityName = useAppStore((s) => s.setPersonalityName);
  const customPrompt = useAppStore((s) => s.customPrompt);
  const setCustomPrompt = useAppStore((s) => s.setCustomPrompt);
  const verbose = useAppStore((s) => s.verbose);
  const toggleVerbose = useAppStore((s) => s.toggleVerbose);
  const resetPersonality = useAppStore((s) => s.resetPersonality);
  const newConversation = useAppStore((s) => s.newConversation);

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>PROMPT MODE</div>
        <div className={styles.modeRow}>
          {PROMPT_MODES.map((m) => (
            <button
              key={m.key}
              className={`${styles.modeBtn} ${promptMode === m.key ? styles.modeBtnOn : ''}`}
              onClick={() => setPromptMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {promptMode === 'personality' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>PERSONALITY</div>

          <textarea
            className={styles.textarea}
            rows={3}
            value={personalityName}
            onChange={(e) => setPersonalityName(e.target.value)}
            placeholder="e.g. a sarcastic pirate captain"
          />
          <p className={styles.info}>
            Anything goes: a character, a description, an emoji, an abstract concept. The system prompt becomes
            “Assume the personality of [this]. Roleplay and never break character.”
          </p>

          {/* Picking a persona starts a new chat — continuing an existing one under a different voice would leave earlier replies in the wrong character. */}
          <label className={styles.fieldLabel}>Alternates</label>
          <select
            className={styles.select}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              setPersonalityName(e.target.value);
              newConversation();
            }}
          >
            <option value="">Choose a persona…</option>
            {PERSONA_PRESETS.map((p) => (
              <option key={p.label} value={p.description}>
                {p.label}
              </option>
            ))}
          </select>

          <div className={styles.toolRow} style={{ marginTop: 14 }}>
            <span className={styles.toolText}>
              <span className={styles.toolLabel}>Verbose mode</span>
              <span className={styles.toolHint}>Drop the “keep responses short” guideline</span>
            </span>
            <button className={`${styles.switch} ${verbose ? styles.on : ''}`} onClick={toggleVerbose}>
              <span className={`${styles.switchKnob} ${verbose ? styles.on : ''}`} />
            </button>
          </div>

          <div className={styles.partyActions}>
            <button
              className={styles.secondaryBtn}
              onClick={() => {
                resetPersonality();
                newConversation();
              }}
            >
              Reset to default
            </button>
          </div>
        </div>
      )}

      {promptMode === 'custom' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>CUSTOM SYSTEM PROMPT</div>
          <textarea
            className={styles.textarea}
            rows={8}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter a complete system prompt…"
          />
          <p className={styles.info}>Sent verbatim as the system prompt.</p>
        </div>
      )}

      {promptMode === 'none' && (
        <div className={styles.section}>
          <p className={styles.info}>No system prompt will be sent to the model.</p>
        </div>
      )}

      {promptMode === 'party' && <PartyForm />}
    </>
  );
}
