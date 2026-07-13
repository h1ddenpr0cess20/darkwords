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
        <img className={styles.image} src={image.src} alt={image.label} />
        <div className={styles.bar}>
          <span className={styles.caption}>{image.label}</span>
          <button className={styles.btn} onClick={download}>
            Download
          </button>
          <button className={styles.btn} onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
