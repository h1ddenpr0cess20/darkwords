import { useAppStore } from '../../../store/useAppStore';
import styles from '../SettingsPanel.module.css';

export function LocationTab() {
  const enabled = useAppStore((s) => s.locationEnabled);
  const locationString = useAppStore((s) => s.locationString);
  const error = useAppStore((s) => s.locationError);
  const loading = useAppStore((s) => s.locationLoading);
  const enableLocation = useAppStore((s) => s.enableLocation);
  const disableLocation = useAppStore((s) => s.disableLocation);

  const toggle = () => {
    if (enabled) disableLocation();
    else void enableLocation();
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>LOCATION</div>
      <p className={styles.info}>
        Shares your approximate coordinates and timezone with the model so it can answer location-aware questions. The
        position comes from your browser's geolocation only — nothing is sent to any third-party service.
      </p>

      <div className={styles.toolRow}>
        <span className={styles.toolText}>
          <span className={styles.toolLabel}>Share my location</span>
          <span className={styles.toolHint}>
            {loading
              ? 'Requesting location…'
              : enabled && locationString
                ? `Current: ${locationString}`
                : error
                  ? `Error: ${error}`
                  : 'Off — the model is not told where you are'}
          </span>
        </span>
        <button className={`${styles.switch} ${enabled ? styles.on : ''}`} onClick={toggle} disabled={loading}>
          <span className={`${styles.switchKnob} ${enabled ? styles.on : ''}`} />
        </button>
      </div>

      {enabled && (
        <div className={styles.partyActions}>
          <button className={styles.secondaryBtn} onClick={() => void enableLocation()} disabled={loading}>
            Refresh location
          </button>
        </div>
      )}
    </div>
  );
}
