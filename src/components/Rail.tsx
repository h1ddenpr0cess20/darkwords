import { useEffect, useRef, type CSSProperties } from 'react';
import { useAppStore } from '../store/useAppStore';
import { resolveModel } from '../lib/models';
import { useAccent } from '../lib/theme';
import styles from './Rail.module.css';

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
function GalleryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export function Rail() {
  const { accent, accentBg } = useAccent();
  const activePanel = useAppStore((s) => s.activePanel);
  const newConversation = useAppStore((s) => s.newConversation);
  const openHistory = useAppStore((s) => s.openHistory);
  const openGallery = useAppStore((s) => s.openGallery);
  const openSettings = useAppStore((s) => s.openSettings);
  const modelPickerOpen = useAppStore((s) => s.modelPickerOpen);
  const toggleModelPicker = useAppStore((s) => s.toggleModelPicker);
  const selectModel = useAppStore((s) => s.selectModel);
  const provider = useAppStore((s) => s.provider);
  const anthropicModels = useAppStore((s) => s.anthropicModels);
  const lmStudioModels = useAppStore((s) => s.lmStudioModels);
  const selectedModelId = useAppStore((s) =>
    s.provider === 'lmstudio' ? s.lmStudioModelId : s.selectedModelId,
  );

  const models = provider === 'lmstudio' ? lmStudioModels : anthropicModels;
  const selectedModel = resolveModel(provider, selectedModelId, models);
  const cssVars = { '--accent': accent, '--accent-bg': accentBg } as CSSProperties;

  const modelWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelPickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!modelWrapRef.current?.contains(e.target as Node)) toggleModelPicker();
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') toggleModelPicker();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [modelPickerOpen, toggleModelPicker]);

  return (
    <div className={styles.rail} style={cssVars}>
      <svg width="34" height="34" viewBox="0 0 40 40" fill="none" className={styles.logo}>
        <path
          d="M4 12 L9.5 28.5 L14.5 15.5 L19 28.5 C22 20.5, 26.5 12.5, 33 5.5"
          stroke={accent}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <button onClick={newConversation} title="New chat" className={styles.iconBtn}>
        <ChatIcon />
      </button>
      <button onClick={openHistory} title="History" className={`${styles.iconBtn} ${activePanel === 'history' ? styles.active : ''}`}>
        <HistoryIcon />
      </button>
      <button onClick={openGallery} title="Gallery" className={`${styles.iconBtn} ${activePanel === 'gallery' ? styles.active : ''}`}>
        <GalleryIcon />
      </button>

      <div className={styles.spacer} />

      <button onClick={openSettings} title="Settings" className={`${styles.iconBtn} ${styles.settingsBtn} ${activePanel === 'settings' ? styles.active : ''}`}>
        <SettingsIcon />
      </button>

      <div className={styles.modelWrap} ref={modelWrapRef}>
        <button onClick={toggleModelPicker} title={selectedModel.name} className={styles.modelBtn}>
          {selectedModel.short}
        </button>
        {modelPickerOpen && (
          <div className={styles.modelDropdown}>
            <div className={styles.modelDropdownLabel}>MODEL</div>
            {models.length === 0 && (
              <div className={styles.modelDropdownLabel} style={{ padding: '6px 10px' }}>
                No models loaded — open Settings → Model
              </div>
            )}
            {models.map((mo) => (
              <button
                key={mo.id}
                onClick={() => selectModel(mo.id)}
                className={`${styles.modelRow} ${mo.id === selectedModelId ? styles.selected : ''}`}
              >
                <span className={`${styles.modelDot} ${mo.id === selectedModelId ? styles.selected : ''}`} />
                <span className={styles.modelRowText}>
                  <span className={styles.modelName}>{mo.name}</span>
                  <span className={styles.modelBlurb}>{mo.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
