import { useAppStore } from '../store/useAppStore';
import styles from './PartyBar.module.css';

/**
 * Control bar shown above the input while a party is loaded. Mirrors Wordmark's:
 * pause takes effect at the next safe checkpoint (never mid-stream), stop aborts
 * the loop but keeps whatever a turn already produced, and a stopped party can be
 * resumed with the same cast.
 */
export function PartyBar() {
  const status = useAppStore((s) => s.partyStatus);
  const party = useAppStore((s) => s.activeParty);
  const soloMode = useAppStore((s) => s.partySoloMode);
  const pauseParty = useAppStore((s) => s.pauseParty);
  const resumeParty = useAppStore((s) => s.resumeParty);
  const stopParty = useAppStore((s) => s.stopParty);
  const leaveParty = useAppStore((s) => s.leaveParty);
  const togglePartySoloMode = useAppStore((s) => s.togglePartySoloMode);

  if (!party || status === 'off') return null;

  const cast = party.characters.map((c) => c.name).join(', ');
  const stoppedSolo = status === 'stopped' && soloMode;

  const label =
    status === 'running'
      ? 'Party in progress — type any time to join in'
      : status === 'paused'
        ? 'Party paused'
        : stoppedSolo
          ? 'Chatting solo — resume to bring the party back'
          : 'Party stopped — resume to continue, or chat solo';

  return (
    <div className={styles.bar}>
      <span className={styles.dot} data-status={status} />
      <span className={styles.status}>{label}</span>
      <span className={styles.cast}>{cast}</span>

      <div className={styles.actions}>
        {status === 'running' && (
          <button className={styles.btn} onClick={pauseParty}>
            Pause
          </button>
        )}
        {status === 'stopped' && (
          <button
            className={`${styles.btn} ${stoppedSolo ? styles.btnActive : ''}`}
            onClick={togglePartySoloMode}
            title={
              stoppedSolo
                ? 'Typing sends a normal reply. Click to have your next message resume the party instead.'
                : 'Typing resumes the party. Click to chat normally instead — the party can still catch up on it later.'
            }
          >
            {stoppedSolo ? 'Solo' : 'Chat solo'}
          </button>
        )}
        {(status === 'paused' || status === 'stopped') && (
          <button className={styles.btn} onClick={resumeParty}>
            {status === 'paused' ? 'Resume' : 'Resume party'}
          </button>
        )}
        {status !== 'stopped' && (
          <button className={styles.btn} onClick={stopParty}>
            Stop
          </button>
        )}
        <button className={styles.btn} onClick={leaveParty} title="Leave party mode">
          Leave
        </button>
      </div>
    </div>
  );
}
