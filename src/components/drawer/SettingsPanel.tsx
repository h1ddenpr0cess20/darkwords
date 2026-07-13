import type { CSSProperties } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { MODELS, THEMES } from '../../lib/config';
import { IMAGE_MODEL } from '../../lib/images';
import type { SettingsTab, ToolsEnabled } from '../../types';
import styles from './SettingsPanel.module.css';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'model', label: 'Model' },
  { key: 'tools', label: 'Tools' },
  { key: 'personality', label: 'Personality' },
  { key: 'theme', label: 'Theme' },
  { key: 'apikeys', label: 'API Key' },
];

const TOOL_DEFS: { key: keyof ToolsEnabled; label: string; hint: string }[] = [
  { key: 'web', label: 'Web search', hint: 'Server-side search, run by Anthropic' },
  { key: 'code', label: 'Code interpreter', hint: 'Sandboxed Python, run by Anthropic' },
  { key: 'files', label: 'File attachments', hint: 'Send attached files to the model' },
  { key: 'image', label: 'Image generation', hint: `Calls OpenAI ${IMAGE_MODEL} — needs an OpenAI key` },
];

export function SettingsPanel() {
  const panelTab = useAppStore((s) => s.panelTab);
  const setPanelTab = useAppStore((s) => s.setPanelTab);
  const selectedModelId = useAppStore((s) => s.selectedModelId);
  const selectModel = useAppStore((s) => s.selectModel);
  const toolsEnabled = useAppStore((s) => s.toolsEnabled);
  const toggleTool = useAppStore((s) => s.toggleTool);
  const themeId = useAppStore((s) => s.themeId);
  const setTheme = useAppStore((s) => s.setTheme);
  const personalityText = useAppStore((s) => s.personalityText);
  const setPersonality = useAppStore((s) => s.setPersonality);
  const apiKey = useAppStore((s) => s.apiKey);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const imageApiKey = useAppStore((s) => s.imageApiKey);
  const setImageApiKey = useAppStore((s) => s.setImageApiKey);

  return (
    <>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${panelTab === t.key ? styles.active : ''}`}
            onClick={() => setPanelTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {panelTab === 'model' && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>CLAUDE MODEL</div>
            {MODELS.map((mo) => (
              <button
                key={mo.id}
                className={`${styles.modelRow} ${mo.id === selectedModelId ? styles.selected : ''}`}
                onClick={() => selectModel(mo.id)}
              >
                <span className={`${styles.dot} ${mo.id === selectedModelId ? styles.selected : ''}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{mo.name}</span>
                  <span className={styles.rowBlurb}>{mo.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {panelTab === 'tools' && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>TOOL ACCESS</div>
            {TOOL_DEFS.map((t) => (
              <div key={t.key} className={styles.toolRow}>
                <span className={styles.toolText}>
                  <span className={styles.toolLabel}>{t.label}</span>
                  <span className={styles.toolHint}>{t.hint}</span>
                </span>
                <button
                  className={`${styles.switch} ${toolsEnabled[t.key] ? styles.on : ''}`}
                  onClick={() => toggleTool(t.key)}
                >
                  <span className={`${styles.switchKnob} ${toolsEnabled[t.key] ? styles.on : ''}`} />
                </button>
              </div>
            ))}
            {toolsEnabled.image && !imageApiKey && (
              <span className={styles.warn}>
                Image generation is on but no OpenAI key is set — the tool stays hidden from the model until you add
                one.
              </span>
            )}
          </div>
        )}

        {panelTab === 'personality' && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>SYSTEM PROMPT</div>
            <textarea
              className={styles.textarea}
              rows={7}
              value={personalityText}
              onChange={(e) => setPersonality(e.target.value)}
            />
          </div>
        )}

        {panelTab === 'theme' && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>ACCENT THEME</div>
            <div className={styles.themeRow}>
              {THEMES.map((th) => {
                const vars = { borderColor: themeId === th.id ? th.color : undefined } as CSSProperties;
                return (
                  <button
                    key={th.id}
                    className={`${styles.themeBtn} ${themeId === th.id ? styles.selected : ''}`}
                    style={vars}
                    onClick={() => setTheme(th.id)}
                  >
                    <span className={styles.themeSwatch} style={{ background: th.color }} />
                    <span className={styles.themeLabel}>{th.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {panelTab === 'apikeys' && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>ANTHROPIC API KEY</div>
            <input
              type="password"
              className={styles.apiInput}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
            />
            <span className={styles.hint}>Required for chat. Sent only to api.anthropic.com.</span>

            <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
              OPENAI API KEY
            </div>
            <input
              type="password"
              className={styles.apiInput}
              value={imageApiKey}
              onChange={(e) => setImageApiKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
            />
            <span className={styles.hint}>
              Optional. Powers the image-generation tool via {IMAGE_MODEL}; sent only to api.openai.com.
            </span>

            <span className={styles.hint} style={{ marginTop: 14 }}>
              Both keys are kept in this browser’s localStorage and used directly from the page. That is fine for
              local single-user use; put the keys behind a backend proxy before deploying this anywhere shared.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
