import { useAppStore } from '../../store/useAppStore';
import { CONVERSATION_TYPES, MOODS, type PartyToolKey } from '../../lib/party/types';
import styles from './SettingsPanel.module.css';

const CHARACTER_TOOLS: { key: PartyToolKey; label: string }[] = [
  { key: 'web', label: 'web' },
  { key: 'code', label: 'code' },
  { key: 'image', label: 'image' },
];

/**
 * Party setup: the scenario the cast converses within, and the cast itself.
 * Every character shares the model selected in the Model tab; only persona, name
 * and tool access differ.
 */
export function PartyForm() {
  const draft = useAppStore((s) => s.partyDraft);
  const setPartyUserName = useAppStore((s) => s.setPartyUserName);
  const setPartyScenario = useAppStore((s) => s.setPartyScenario);
  const addPartyCharacter = useAppStore((s) => s.addPartyCharacter);
  const updatePartyCharacter = useAppStore((s) => s.updatePartyCharacter);
  const removePartyCharacter = useAppStore((s) => s.removePartyCharacter);
  const togglePartyCharacterTool = useAppStore((s) => s.togglePartyCharacterTool);
  const startParty = useAppStore((s) => s.startParty);

  const namedCast = draft.characters.filter((c) => c.name.trim() || c.persona.trim());
  const canStart = namedCast.length >= 2;

  return (
    <div className={styles.section}>
      <p className={styles.info}>
        A multi-character group chat: the cast converses on its own and you can jump in at any time. Everyone uses the
        model selected in the Model tab.
      </p>

      <div className={styles.sectionLabel} style={{ marginTop: 14 }}>
        SCENARIO
      </div>

      <label className={styles.fieldLabel}>What the characters call you</label>
      <input
        className={styles.apiInput}
        value={draft.userName ?? ''}
        onChange={(e) => setPartyUserName(e.target.value)}
        placeholder="Observer"
      />

      <label className={styles.fieldLabel}>Topic</label>
      <input
        className={styles.apiInput}
        value={draft.scenario.topic}
        onChange={(e) => setPartyScenario({ topic: e.target.value })}
        placeholder="e.g. the future of space travel"
      />

      <label className={styles.fieldLabel}>Setting</label>
      <input
        className={styles.apiInput}
        value={draft.scenario.setting}
        onChange={(e) => setPartyScenario({ setting: e.target.value })}
        placeholder="e.g. a dimly lit jazz bar"
      />

      <div className={styles.selectRow}>
        <div className={styles.selectCol}>
          <label className={styles.fieldLabel}>Mood</label>
          <select
            className={styles.select}
            value={draft.scenario.mood}
            onChange={(e) => setPartyScenario({ mood: e.target.value })}
          >
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {m[0].toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.selectCol}>
          <label className={styles.fieldLabel}>Conversation type</label>
          <select
            className={styles.select}
            value={draft.scenario.conversationType}
            onChange={(e) => setPartyScenario({ conversationType: e.target.value })}
          >
            {CONVERSATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
        CAST
      </div>
      <p className={styles.info}>Add at least two characters. Each can be granted its own tools.</p>

      {draft.characters.map((c) => (
        <div key={c.id} className={styles.character}>
          <div className={styles.characterHead}>
            <span className={styles.characterDot} style={{ background: c.color }} />
            <input
              className={styles.characterName}
              value={c.name}
              onChange={(e) => updatePartyCharacter(c.id, { name: e.target.value })}
              placeholder="Name"
            />
            <button
              className={styles.characterRemove}
              onClick={() => removePartyCharacter(c.id)}
              title="Remove character"
            >
              ✕
            </button>
          </div>
          <textarea
            className={styles.characterPersona}
            rows={4}
            value={c.persona}
            onChange={(e) => updatePartyCharacter(c.id, { persona: e.target.value })}
            placeholder="Persona — e.g. a cynical ex-detective who trusts no one"
          />
          <div className={styles.characterTools}>
            {CHARACTER_TOOLS.map((t) => (
              <button
                key={t.key}
                className={`${styles.toolChip} ${c.allowedTools.includes(t.key) ? styles.toolChipOn : ''}`}
                onClick={() => togglePartyCharacterTool(c.id, t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className={styles.partyActions}>
        <button className={styles.secondaryBtn} onClick={addPartyCharacter}>
          Add character
        </button>
        <button
          className={styles.primaryBtn}
          onClick={startParty}
          disabled={!canStart}
          title={canStart ? 'Start a new party conversation' : 'Add at least two characters'}
        >
          Start party
        </button>
      </div>
    </div>
  );
}
