import type { CSSProperties } from 'react';
import type { ChatMessage } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useAccent } from '../lib/theme';
import { CodeBlock } from './CodeBlock';
import { Markdown } from './Markdown';
import { MessageActions } from './MessageActions';
import { MarginAnnotations } from './MarginAnnotations';
import styles from './MessageRow.module.css';

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2" style={{ flex: 'none' }}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function MessageRow({ message }: { message: ChatMessage }) {
  const { accent, accentBg } = useAccent();
  const openLightbox = useAppStore((s) => s.openLightbox);
  const isUser = message.role === 'user';
  const nameColor = message.nameColor ?? (isUser ? 'var(--text-0)' : accent);
  const avatarBg = isUser ? 'var(--row-bg-alt)' : accentBg;
  const avatarColor = isUser ? 'var(--text-2)' : accent;
  const avatarLabel = isUser ? 'Y' : message.displayName.charAt(0).toUpperCase();

  const rowVars = { '--accent': accent, '--accent-bg': accentBg, '--accent-border': `${accent}55` } as CSSProperties;

  return (
    <div className={`${styles.row} dw-row`} style={rowVars}>
      <div className={styles.main}>
        <div className={styles.head}>
          <span className={styles.avatar} style={{ background: avatarBg, color: avatarColor }}>
            {avatarLabel}
          </span>
          <span className={styles.name} style={{ color: nameColor }}>
            {message.displayName}
          </span>
          <span className={styles.time}>{message.time}</span>
        </div>

        <div className={styles.body}>
          {message.attachments.length > 0 && (
            <div className={styles.attachments}>
              {message.attachments.map((att) => (
                <div key={att.id} className={styles.attachment}>
                  <FileIcon />
                  <span className={styles.attachmentName}>{att.name}</span>
                </div>
              ))}
            </div>
          )}

          {message.rawText ? (
            <Markdown text={message.rawText} />
          ) : (
            message.parts.map((part, i) =>
              part.type === 'code' ? (
                <CodeBlock key={i} code={part.text} />
              ) : part.type === 'list' ? (
                <ul key={i} className={styles.list}>
                  {part.items.map((item, j) => (
                    <li key={j} className={styles.para}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p key={i} className={styles.para}>
                  {part.text}
                </p>
              ),
            )
          )}

          {message.error && !message.streaming && message.parts.length === 0 && (
            <p className={styles.errorText}>{message.error}</p>
          )}

          {message.streaming && !message.rawText && (
            <div className={styles.streamDots}>
              <span className={styles.dot} style={{ animationDelay: '0s' }} />
              <span className={styles.dot} style={{ animationDelay: '.15s' }} />
              <span className={styles.dot} style={{ animationDelay: '.3s' }} />
            </div>
          )}

          {(message.imageGen ?? []).map((img, i) => (
            <figure key={i} className={styles.figure}>
              <img
                className={styles.image}
                src={img.src}
                alt={img.label}
                loading="lazy"
                onClick={() => openLightbox(img)}
              />
              <figcaption className={styles.caption}>{img.label}</figcaption>
            </figure>
          ))}

          {(message.generatedFiles ?? []).length > 0 && (
            <div className={styles.attachments}>
              {(message.generatedFiles ?? []).map((file) => (
                <a key={file.id} className={styles.generatedFile} href={file.dataUrl} download={file.name}>
                  <FileIcon />
                  <span className={styles.attachmentName}>{file.name}</span>
                  <DownloadIcon />
                </a>
              ))}
            </div>
          )}

          {!message.streaming && <MessageActions message={message} />}
        </div>
      </div>

      <MarginAnnotations message={message} />
    </div>
  );
}
