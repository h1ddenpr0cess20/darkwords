import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import styles from './Lightbox.module.css';

/**
 * Full-size image viewer. Images are base64 data URLs, and browsers block
 * top-level navigation to `data:` — so opening one in a new tab silently does
 * nothing. It has to be shown in-app.
 */
export function Lightbox() {
  const image = useAppStore((s) => s.lightbox);
  const close = useAppStore((s) => s.closeLightbox);

  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [image, close]);

  if (!image) return null;

  const download = () => {
    const a = document.createElement('a');
    a.href = image.src;
    a.download = `${image.label.replace(/[^\w\s-]/g, '').trim().slice(0, 60) || 'image'}.png`;
    a.click();
  };

  return (
    <div className={styles.overlay} onClick={close} role="dialog" aria-modal="true">
      <div className={styles.inner} onClick={(e) => e.stopPropagation()}>
        <div className={styles.bar}>
          <button className={styles.btn} onClick={download} title="Download">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="M7 11l5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </button>
          <button className={styles.btn} onClick={close} title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <img className={styles.image} src={image.src} alt={image.label} />
        {image.label && <span className={styles.caption}>{image.label}</span>}
      </div>
    </div>
  );
}
