import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import styles from './SettingsPanel.module.css';

/**
 * Remote MCP servers, connected through Anthropic's MCP connector. Anthropic
 * makes the connection server-side, so the browser never talks to the MCP server
 * directly and there is no CORS problem.
 */
export function McpServers() {
  const servers = useAppStore((s) => s.mcpServers);
  const addMcpServer = useAppStore((s) => s.addMcpServer);
  const toggleMcpServer = useAppStore((s) => s.toggleMcpServer);
  const removeMcpServer = useAppStore((s) => s.removeMcpServer);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authToken, setAuthToken] = useState('');

  const submit = () => {
    if (!name.trim() || !url.trim()) return;
    addMcpServer({ name: name.trim(), url: url.trim(), authToken: authToken.trim() || undefined });
    setName('');
    setUrl('');
    setAuthToken('');
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>MCP SERVERS</div>
      <p className={styles.info}>
        Connect a remote MCP server to give Claude its tools. Anthropic connects to it server-side.
      </p>

      {servers.map((m) => (
        <div key={m.id} className={styles.character}>
          <div className={styles.characterHead}>
            <span className={styles.characterDot} style={{ background: m.enabled ? 'var(--accent)' : 'var(--text-7)' }} />
            <span className={styles.listTitle}>{m.name}</span>
            <button
              className={`${styles.switch} ${m.enabled ? styles.on : ''}`}
              onClick={() => toggleMcpServer(m.id)}
              title={m.enabled ? 'Disable' : 'Enable'}
            >
              <span className={`${styles.switchKnob} ${m.enabled ? styles.on : ''}`} />
            </button>
            <button className={styles.characterRemove} onClick={() => removeMcpServer(m.id)} title="Remove server">
              ✕
            </button>
          </div>
          <span className={styles.toolHint}>{m.url}</span>
        </div>
      ))}

      <label className={styles.fieldLabel}>Name</label>
      <input
        className={styles.apiInput}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="linear"
      />

      <label className={styles.fieldLabel}>URL</label>
      <input
        className={styles.apiInput}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://mcp.example.com/mcp"
      />

      <label className={styles.fieldLabel}>Auth token (optional)</label>
      <input
        type="password"
        className={styles.apiInput}
        value={authToken}
        onChange={(e) => setAuthToken(e.target.value)}
        placeholder="Bearer token, if the server needs one"
        autoComplete="off"
      />

      <div className={styles.partyActions}>
        <button className={styles.primaryBtn} onClick={submit} disabled={!name.trim() || !url.trim()}>
          Add server
        </button>
      </div>
    </div>
  );
}
