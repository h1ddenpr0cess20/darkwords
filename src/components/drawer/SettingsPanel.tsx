import { useAppStore } from '../../store/useAppStore';
import { ModelTab } from './tabs/ModelTab';
import { ToolsTab } from './tabs/ToolsTab';
import { PersonalityTab } from './tabs/PersonalityTab';
import { ThemeTab } from './tabs/ThemeTab';
import { KeysTab } from './tabs/KeysTab';
import { AboutTab } from './tabs/AboutTab';
import { MemoryPanel } from './MemoryPanel';
import { SkillsPanel } from './SkillsPanel';
import { McpServers } from './McpServers';
import { DataPanel } from './DataPanel';
import type { SettingsTab } from '../../types';
import styles from './SettingsPanel.module.css';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'personality', label: 'Personality' },
  { key: 'model', label: 'Model' },
  { key: 'tools', label: 'Tools' },
  { key: 'memory', label: 'Memory' },
  { key: 'skills', label: 'Skills' },
  { key: 'theme', label: 'Theme' },
  { key: 'apikeys', label: 'Keys' },
  { key: 'data', label: 'Data' },
  { key: 'about', label: 'About' },
];

export function SettingsPanel() {
  const panelTab = useAppStore((s) => s.panelTab);
  const setPanelTab = useAppStore((s) => s.setPanelTab);

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
        {panelTab === 'model' && <ModelTab />}
        {panelTab === 'tools' && (
          <>
            <ToolsTab />
            <McpServers />
          </>
        )}
        {panelTab === 'personality' && <PersonalityTab />}
        {panelTab === 'memory' && <MemoryPanel />}
        {panelTab === 'skills' && <SkillsPanel />}
        {panelTab === 'theme' && <ThemeTab />}
        {panelTab === 'apikeys' && <KeysTab />}
        {panelTab === 'data' && <DataPanel />}
        {panelTab === 'about' && <AboutTab />}
      </div>
    </div>
  );
}
