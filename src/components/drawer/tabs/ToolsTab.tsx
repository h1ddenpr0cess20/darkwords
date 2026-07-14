import { useAppStore } from '../../../store/useAppStore';
import { IMAGE_MODEL } from '../../../lib/images';
import type { ToolsEnabled } from '../../../types';
import styles from '../SettingsPanel.module.css';

const TOOL_DEFS: { key: keyof ToolsEnabled; label: string; hint: string }[] = [
  { key: 'web', label: 'Web search', hint: 'Server-side search, run by Anthropic' },
  { key: 'code', label: 'Code interpreter', hint: 'Sandboxed Python, run by Anthropic' },
  { key: 'files', label: 'File attachments', hint: 'Send attached files to the model' },
  { key: 'image', label: 'Image generation', hint: `Calls OpenAI ${IMAGE_MODEL} — needs an OpenAI key` },
];

export function ToolsTab() {
  const toolsEnabled = useAppStore((s) => s.toolsEnabled);
  const toggleTool = useAppStore((s) => s.toggleTool);
  const imageApiKey = useAppStore((s) => s.imageApiKey);
  const provider = useAppStore((s) => s.provider);

  const local = provider === 'lmstudio';

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>TOOL ACCESS</div>
      {TOOL_DEFS.map((t) => {
        const unavailable = local && t.key !== 'image';
        return (
          <div key={t.key} className={styles.toolRow} style={unavailable ? { opacity: 0.45 } : undefined}>
            <span className={styles.toolText}>
              <span className={styles.toolLabel}>{t.label}</span>
              <span className={styles.toolHint}>
                {unavailable
                  ? t.key === 'files'
                    ? 'With LM Studio, attachments are searched locally instead'
                    : 'Unavailable with LM Studio'
                  : t.hint}
              </span>
            </span>
            <button
              className={`${styles.switch} ${toolsEnabled[t.key] && !unavailable ? styles.on : ''}`}
              onClick={() => toggleTool(t.key)}
              disabled={unavailable}
            >
              <span className={`${styles.switchKnob} ${toolsEnabled[t.key] && !unavailable ? styles.on : ''}`} />
            </button>
          </div>
        );
      })}
      {toolsEnabled.image && !imageApiKey && (
        <span className={styles.warn}>
          Image generation is on but no OpenAI key is set — the tool stays hidden from the model until you add one.
        </span>
      )}
    </div>
  );
}
