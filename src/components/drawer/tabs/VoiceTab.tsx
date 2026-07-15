import { useAppStore } from '../../../store/useAppStore';
import { buildTtsInstructions, TTS_MODEL, TTS_TEST_PHRASE, TTS_VOICES } from '../../../lib/tts';
import { ttsPlayback, TTS_SAMPLE_ID } from '../../../lib/ttsPlayback';
import { useTtsState } from '../../useTtsState';
import styles from '../SettingsPanel.module.css';

/**
 * Settings → Voice. OpenAI text-to-speech for finished assistant replies. It
 * reuses the OpenAI key from Settings → Keys (the same one image generation
 * uses), so it works no matter which chat provider is selected.
 */
export function VoiceTab() {
  const enabled = useAppStore((s) => s.ttsEnabled);
  const toggle = useAppStore((s) => s.toggleTts);
  const autoplay = useAppStore((s) => s.ttsAutoplay);
  const toggleAutoplay = useAppStore((s) => s.toggleTtsAutoplay);
  const voice = useAppStore((s) => s.ttsVoice);
  const setVoice = useAppStore((s) => s.setTtsVoice);
  const instructions = useAppStore((s) => s.ttsInstructions);
  const setInstructions = useAppStore((s) => s.setTtsInstructions);
  const apiKey = useAppStore((s) => s.imageApiKey);
  const promptMode = useAppStore((s) => s.promptMode);
  const personalityName = useAppStore((s) => s.personalityName);

  const sample = useTtsState(TTS_SAMPLE_ID);
  const testing = sample.status === 'loading';

  const testVoice = () => {
    void ttsPlayback.playSample({
      apiKey,
      text: TTS_TEST_PHRASE,
      voice,
      instructions: buildTtsInstructions({ instructions, promptMode, personalityName }),
    });
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>VOICE PLAYBACK</div>

      <div className={styles.toolRow}>
        <span className={styles.toolText}>
          <span className={styles.toolLabel}>Text-to-speech</span>
          <span className={styles.toolHint}>Read assistant replies aloud with OpenAI {TTS_MODEL}</span>
        </span>
        <button className={`${styles.switch} ${enabled ? styles.on : ''}`} onClick={toggle}>
          <span className={`${styles.switchKnob} ${enabled ? styles.on : ''}`} />
        </button>
      </div>

      <div className={styles.toolRow} style={enabled ? undefined : { opacity: 0.45 }}>
        <span className={styles.toolText}>
          <span className={styles.toolLabel}>Autoplay</span>
          <span className={styles.toolHint}>Speak each reply as it finishes</span>
        </span>
        <button
          className={`${styles.switch} ${autoplay && enabled ? styles.on : ''}`}
          onClick={toggleAutoplay}
          disabled={!enabled}
        >
          <span className={`${styles.switchKnob} ${autoplay && enabled ? styles.on : ''}`} />
        </button>
      </div>

      <label className={styles.fieldLabel}>Voice</label>
      <select className={styles.select} value={voice} onChange={(e) => setVoice(e.target.value)} disabled={!enabled}>
        {TTS_VOICES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} · {v.gender}
          </option>
        ))}
      </select>

      <label className={styles.fieldLabel}>Voice instructions</label>
      <textarea
        className={styles.textarea}
        rows={3}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="e.g. Speak slowly, with a wry, deadpan delivery"
        disabled={!enabled}
      />
      <p className={styles.info}>
        Optional direction for tone and delivery. Left blank, an active personality prompt shapes the voice; otherwise a
        neutral conversational tone is used.
      </p>

      <div className={styles.partyActions}>
        <button className={styles.secondaryBtn} onClick={testVoice} disabled={!enabled || !apiKey || testing}>
          {testing ? 'Testing…' : 'Test voice'}
        </button>
        <button className={styles.secondaryBtn} onClick={() => ttsPlayback.stopActive()} disabled={!enabled}>
          Stop
        </button>
        <button className={styles.secondaryBtn} onClick={() => void ttsPlayback.clearAll()}>
          Clear cached audio
        </button>
      </div>
      {sample.error && <span className={styles.warn}>{sample.error}</span>}

      {enabled && !apiKey && (
        <span className={styles.warn}>
          Voice playback is on but no OpenAI key is set — add one in Settings → Keys before replies can be voiced.
        </span>
      )}
    </div>
  );
}
