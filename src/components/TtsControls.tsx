import type { ChatMessage } from '../types';
import { useAppStore } from '../store/useAppStore';
import { buildTtsInstructions } from '../lib/tts';
import { ttsPlayback, type SpeakOpts } from '../lib/ttsPlayback';
import { DownloadIcon, PauseIcon, PlayIcon, StopIcon } from './icons';
import { useTtsState } from './useTtsState';
import styles from './TtsControls.module.css';

/**
 * Inline play/pause/stop/download controls for one assistant message, shown when
 * voice playback is enabled. Synthesis is on demand — nothing is generated until
 * the play button is pressed. Autoplay for a *new* reply is driven separately at
 * turn-finalize (see `lib/ttsAutoplay.ts`); mounting these controls on an
 * existing message never spends tokens.
 */
export function TtsControls({ message }: { message: ChatMessage }) {
  const voice = useAppStore((s) => s.ttsVoice);
  const instructionsOverride = useAppStore((s) => s.ttsInstructions);
  const apiKey = useAppStore((s) => s.imageApiKey);
  const promptMode = useAppStore((s) => s.promptMode);
  const personalityName = useAppStore((s) => s.personalityName);

  const { status, error } = useTtsState(message.id);

  const opts = (): SpeakOpts => ({
    apiKey,
    text: message.rawText,
    voice,
    instructions: buildTtsInstructions({ instructions: instructionsOverride, promptMode, personalityName }),
  });

  const download = async () => {
    const data = await ttsPlayback.getAudioData(message.id, opts());
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `tts_${voice}_${stamp}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const loading = status === 'loading';
  const playing = status === 'playing';
  const hasAudio = status !== 'idle' || ttsPlayback.hasAudio(message.id);

  return (
    <span className={styles.tts}>
      <button
        className={styles.btn}
        onClick={() => void ttsPlayback.toggle(message.id, opts())}
        disabled={loading}
        title={playing ? 'Pause voice' : 'Play voice'}
        aria-label={playing ? 'Pause voice' : 'Play voice'}
      >
        {loading ? <span className={styles.spinner} /> : playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
      </button>

      {hasAudio && (
        <button
          className={styles.btn}
          onClick={() => ttsPlayback.stop(message.id)}
          title="Stop voice"
          aria-label="Stop voice"
        >
          <StopIcon size={13} />
        </button>
      )}

      <button className={styles.btn} onClick={() => void download()} title="Download audio" aria-label="Download audio">
        <DownloadIcon size={13} />
      </button>

      {error && <span className={styles.error}>{error}</span>}
    </span>
  );
}
