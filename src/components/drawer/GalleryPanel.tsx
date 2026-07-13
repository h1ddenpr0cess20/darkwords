import { useAppStore } from '../../store/useAppStore';
import styles from './GalleryPanel.module.css';

export function GalleryPanel() {
  const items = useAppStore((s) => s.galleryItems);
  const openLightbox = useAppStore((s) => s.openLightbox);

  return (
    <div className={styles.wrap}>
      {items.length === 0 && (
        <div className={styles.empty}>
          Nothing here yet — images you attach, and images the model generates, will show up in this gallery.
        </div>
      )}
      <div className={styles.grid}>
        {items.map((g) => (
          <button
            key={g.id}
            className={styles.tile}
            onClick={() => openLightbox({ src: g.src, label: g.label })}
            title={g.label}
          >
            <img className={styles.image} src={g.src} alt={g.label} loading="lazy" />
            <div className={styles.caption}>
              <span className={styles.kind}>{g.kind}</span>
              <span className={styles.label}>{g.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
