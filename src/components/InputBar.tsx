import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { makeId } from '../lib/id';
import { blobToDataUrl } from '../lib/dataUrl';
import { groupAttachmentsByFolder } from '../lib/attachmentGroups';
import { PartyBar } from './PartyBar';
import styles from './InputBar.module.css';

/**
 * Caps how tall the textarea grows before it scrolls internally instead —
 * must stay in sync with `.textarea`'s max-height in InputBar.module.css.
 * The floating input bar overlaps the feed above a certain height (the feed
 * only reserves so much bottom padding for it), so this has to leave room
 * for the bar's own padding/border and the wrap's bottom padding on top.
 */
const TEXTAREA_MAX_HEIGHT = 88;

/** Reads a picked file into an Attachment, inlining its bytes as a data URL. */
async function readFileAsAttachment(
  file: File,
): Promise<{ id: string; name: string; mimeType: string; size: number; dataUrl: string }> {
  return {
    id: makeId('att'),
    name: file.webkitRelativePath || file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl: await blobToDataUrl(file),
  };
}

export function InputBar() {
  const input = useAppStore((s) => s.input);
  const setInput = useAppStore((s) => s.setInput);
  const uploads = useAppStore((s) => s.pendingUploads);
  const addUpload = useAppStore((s) => s.addUpload);
  const removeUpload = useAppStore((s) => s.removeUpload);
  const clearUploads = useAppStore((s) => s.clearUploads);
  const isSending = useAppStore((s) => s.isSending);
  const sendMessage = useAppStore((s) => s.sendMessage);
  const stopStreaming = useAppStore((s) => s.stopStreaming);

  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const [attachOpen, setAttachOpen] = useState(false);

  /**
   * The input bar floats over the feed, which reserves bottom padding via
   * this CSS var to keep the last message clear of it. The bar's height
   * varies with the party control bar, upload chips, and textarea growth,
   * so it's measured rather than guessed.
   */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const setSpace = () => {
      document.documentElement.style.setProperty('--input-bar-space', `${el.offsetHeight + 24}px`);
    };
    setSpace();
    const ro = new ResizeObserver(setSpace);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!attachOpen) return;
    const onDown = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) setAttachOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [attachOpen]);

  /**
   * Runs on every input change, including when sending clears the draft, so
   * the textarea also shrinks back after the send button empties it.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: resize on every draft change
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, [input]);

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isSending) return;
      void sendMessage();
    }
  };

  const uploadGroups = groupAttachmentsByFolder(uploads);

  const onFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      const att = await readFileAsAttachment(file);
      addUpload(att);
    }
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inner}>
        <PartyBar />
        {uploads.length > 0 && (
          <div className={styles.uploads}>
            {uploads.length > 1 && (
              <button className={styles.uploadClear} onClick={clearUploads}>
                Clear all
              </button>
            )}
            {uploadGroups.map((g) => (
              <div key={g.key} className={styles.uploadChip}>
                <span className={styles.uploadName}>{g.folder ? `${g.folder} (${g.count})` : g.label}</span>
                <button
                  className={styles.uploadRemove}
                  onClick={() => {
                    for (const id of g.ids) removeUpload(id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.bar}>
          <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesSelected} />
          <input
            ref={dirInputRef}
            type="file"
            multiple
            hidden
            onChange={onFilesSelected}
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          />
          <div className={styles.attachWrap} ref={attachRef}>
            <button
              className={styles.attachBtn}
              title="Attach files or a folder"
              onClick={() => setAttachOpen((v) => !v)}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            {attachOpen && (
              <div className={styles.attachMenu}>
                <button
                  className={styles.attachMenuItem}
                  onClick={() => {
                    setAttachOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  Attach files
                </button>
                <button
                  className={styles.attachMenuItem}
                  onClick={() => {
                    setAttachOpen(false);
                    dirInputRef.current?.click();
                  }}
                >
                  Attach folder
                </button>
              </div>
            )}
          </div>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Message Darkwords…"
            rows={1}
          />
          {isSending ? (
            <button className={styles.sendBtn} title="Stop" onClick={stopStreaming}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              className={styles.sendBtn}
              title="Send"
              disabled={!input.trim() && uploads.length === 0}
              onClick={() => void sendMessage()}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" />
                <path d="M6 12h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
