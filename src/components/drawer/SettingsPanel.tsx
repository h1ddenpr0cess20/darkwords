import type { CSSProperties } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { MODELS, THEMES } from '../../lib/config';
import { IMAGE_MODEL } from '../../lib/images';
import { PartyForm } from './PartyForm';
import { MemoryPanel } from './MemoryPanel';
import { SkillsPanel } from './SkillsPanel';
import { McpServers } from './McpServers';
import { DataPanel } from './DataPanel';
import type { Effort, PromptMode, SettingsTab, ToolsEnabled } from '../../types';
import styles from './SettingsPanel.module.css';

const PROMPT_MODES: { key: PromptMode; label: string }[] = [
  { key: 'personality', label: 'Personality' },
  { key: 'custom', label: 'Custom' },
  { key: 'none', label: 'None' },
  { key: 'party', label: 'Party' },
];

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'model', label: 'Model' },
  { key: 'tools', label: 'Tools' },
  { key: 'personality', label: 'Personality' },
  { key: 'memory', label: 'Memory' },
  { key: 'skills', label: 'Skills' },
  { key: 'theme', label: 'Theme' },
  { key: 'apikeys', label: 'Keys' },
  { key: 'data', label: 'Data' },
];

const EFFORTS: { key: Effort | null; label: string; hint: string }[] = [
  { key: null, label: 'Default', hint: 'Whatever the selected model uses' },
  { key: 'low', label: 'Low', hint: 'Fastest, cheapest; shallow reasoning' },
  { key: 'medium', label: 'Medium', hint: 'Balanced' },
  { key: 'high', label: 'High', hint: 'Recommended for anything intelligence-sensitive' },
  { key: 'xhigh', label: 'X-High', hint: 'Best for hard coding and agentic work' },
  { key: 'max', label: 'Max', hint: 'Correctness over cost; can overthink' },
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
  const promptMode = useAppStore((s) => s.promptMode);
  const setPromptMode = useAppStore((s) => s.setPromptMode);
  const personalityName = useAppStore((s) => s.personalityName);
  const setPersonalityName = useAppStore((s) => s.setPersonalityName);
  const customPrompt = useAppStore((s) => s.customPrompt);
  const setCustomPrompt = useAppStore((s) => s.setCustomPrompt);
  const verbose = useAppStore((s) => s.verbose);
  const toggleVerbose = useAppStore((s) => s.toggleVerbose);
  const resetPersonality = useAppStore((s) => s.resetPersonality);
  const apiKey = useAppStore((s) => s.apiKey);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const imageApiKey = useAppStore((s) => s.imageApiKey);
  const setImageApiKey = useAppStore((s) => s.setImageApiKey);
  const effort = useAppStore((s) => s.effort);
  const setEffort = useAppStore((s) => s.setEffort);

  return (
    <div className={styles.body}>
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

            <div className={styles.sectionLabel} style={{ marginTop: 18 }}>
              REASONING EFFORT
            </div>
            <p className={styles.info}>
              How hard Claude thinks before answering. Not supported on Haiku, which never uses extended thinking.
            </p>
            <div className={styles.modeRow}>
              {EFFORTS.map((e) => (
                <button
                  key={e.label}
                  className={`${styles.modeBtn} ${effort === e.key ? styles.modeBtnOn : ''}`}
                  onClick={() => setEffort(e.key)}
                  title={e.hint}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {panelTab === 'memory' && <MemoryPanel />}
        {panelTab === 'skills' && <SkillsPanel />}
        {panelTab === 'data' && <DataPanel />}

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

        {panelTab === 'tools' && <McpServers />}

        {panelTab === 'personality' && (
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
                <input
                  className={styles.apiInput}
                  value={personalityName}
                  onChange={(e) => setPersonalityName(e.target.value)}
                  placeholder="e.g. a sarcastic pirate captain"
                />
                <p className={styles.info}>
                  Anything goes: a character, a description, an emoji, an abstract concept. The system prompt becomes
                  “Assume the personality of [this]. Roleplay and never break character.”
                </p>

                <div className={styles.toolRow}>
                  <span className={styles.toolText}>
                    <span className={styles.toolLabel}>Verbose mode</span>
                    <span className={styles.toolHint}>Drop the “keep responses short” guideline</span>
                  </span>
                  <button className={`${styles.switch} ${verbose ? styles.on : ''}`} onClick={toggleVerbose}>
                    <span className={`${styles.switchKnob} ${verbose ? styles.on : ''}`} />
                  </button>
                </div>

                <div className={styles.partyActions}>
                  <button className={styles.secondaryBtn} onClick={resetPersonality}>
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
    </div>
  );
}
