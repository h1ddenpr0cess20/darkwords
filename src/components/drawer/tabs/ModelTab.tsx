import { useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import type { Effort, Provider } from '../../../types';
import styles from '../SettingsPanel.module.css';

const PROVIDERS: { key: Provider; label: string }[] = [
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'lmstudio', label: 'LM Studio' },
];

const EFFORTS: { key: Effort; label: string; hint: string }[] = [
  { key: 'low', label: 'Low', hint: 'Fastest and cheapest; shallow reasoning' },
  { key: 'medium', label: 'Medium', hint: 'Balanced' },
  { key: 'high', label: 'High', hint: 'Recommended for anything intelligence-sensitive' },
  { key: 'xhigh', label: 'X-High', hint: 'Best for hard coding and agentic work' },
  { key: 'max', label: 'Max', hint: 'Correctness over cost; can overthink' },
];

export function ModelTab() {
  const provider = useAppStore((s) => s.provider);
  const setProvider = useAppStore((s) => s.setProvider);
  const selectModel = useAppStore((s) => s.selectModel);
  const effort = useAppStore((s) => s.effort);
  const setEffort = useAppStore((s) => s.setEffort);
  const lmStudioUrl = useAppStore((s) => s.lmStudioUrl);
  const setLmStudioUrl = useAppStore((s) => s.setLmStudioUrl);
  const embeddingModelId = useAppStore((s) => s.embeddingModelId);
  const setEmbeddingModelId = useAppStore((s) => s.setEmbeddingModelId);
  const anthropicModels = useAppStore((s) => s.anthropicModels);
  const lmStudioModels = useAppStore((s) => s.lmStudioModels);
  const embeddingModels = useAppStore((s) => s.embeddingModels);
  const modelsError = useAppStore((s) => s.modelsError);
  const modelsLoading = useAppStore((s) => s.modelsLoading);
  const refreshModels = useAppStore((s) => s.refreshModels);
  const selectedId = useAppStore((s) => (s.provider === 'lmstudio' ? s.lmStudioModelId : s.selectedModelId));

  const models = provider === 'lmstudio' ? lmStudioModels : anthropicModels;

  useEffect(() => {
    if (!models.length) void refreshModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>PROVIDER</div>
        <div className={styles.modeRow}>
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              className={`${styles.modeBtn} ${provider === p.key ? styles.modeBtnOn : ''}`}
              onClick={() => setProvider(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {provider === 'lmstudio' && (
          <>
            <div className={styles.sectionLabel} style={{ marginTop: 14 }}>
              SERVER URL
            </div>
            <input
              className={styles.apiInput}
              value={lmStudioUrl}
              onChange={(e) => setLmStudioUrl(e.target.value)}
              placeholder="http://localhost:1234"
              spellCheck={false}
            />
            <p className={styles.info}>
              LM Studio's Anthropic-compatible server. Web search, the code interpreter, and native file blocks are
              unavailable; attached documents are searched locally instead.
            </p>
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{provider === 'lmstudio' ? 'LOCAL MODEL' : 'CLAUDE MODEL'}</div>
        {models.map((mo) => (
          <button
            key={mo.id}
            className={`${styles.modelRow} ${mo.id === selectedId ? styles.selected : ''}`}
            onClick={() => selectModel(mo.id)}
          >
            <span className={`${styles.dot} ${mo.id === selectedId ? styles.selected : ''}`} />
            <span className={styles.rowText}>
              <span className={styles.rowName}>{mo.name}</span>
              <span className={styles.rowBlurb}>{mo.blurb}</span>
            </span>
          </button>
        ))}
        {!models.length && !modelsLoading && !modelsError && (
          <p className={styles.info}>No models loaded yet.</p>
        )}
        {modelsError && <span className={styles.warn}>{modelsError}</span>}
        <div className={styles.partyActions}>
          <button className={styles.secondaryBtn} onClick={() => void refreshModels()} disabled={modelsLoading}>
            {modelsLoading ? 'Loading…' : 'Refresh models'}
          </button>
        </div>
      </div>

      {provider === 'lmstudio' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>EMBEDDING MODEL</div>
          <p className={styles.info}>
            Used to index and search attached documents locally. Auto picks a loaded embedding model (nomic
            preferred).
          </p>
          <button
            className={`${styles.modelRow} ${!embeddingModelId ? styles.selected : ''}`}
            onClick={() => setEmbeddingModelId('')}
          >
            <span className={`${styles.dot} ${!embeddingModelId ? styles.selected : ''}`} />
            <span className={styles.rowText}>
              <span className={styles.rowName}>Auto</span>
              <span className={styles.rowBlurb}>Pick a loaded embedding model automatically</span>
            </span>
          </button>
          {embeddingModels.map((id) => (
            <button
              key={id}
              className={`${styles.modelRow} ${embeddingModelId === id ? styles.selected : ''}`}
              onClick={() => setEmbeddingModelId(id)}
            >
              <span className={`${styles.dot} ${embeddingModelId === id ? styles.selected : ''}`} />
              <span className={styles.rowText}>
                <span className={styles.rowName}>{id}</span>
              </span>
            </button>
          ))}
          {!embeddingModels.length && (
            <span className={styles.warn}>
              No embedding model detected — load one in LM Studio (e.g. text-embedding-nomic-embed-text-v1.5) and
              refresh models.
            </span>
          )}
        </div>
      )}

      {provider === 'anthropic' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>REASONING EFFORT</div>
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
    </>
  );
}
