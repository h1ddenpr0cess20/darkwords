import type { CSSProperties } from 'react';
import { Rail } from './components/Rail';
import { TopStrip } from './components/TopStrip';
import { Feed } from './components/Feed';
import { InputBar } from './components/InputBar';
import { Drawer } from './components/drawer/Drawer';
import { Lightbox } from './components/Lightbox';
import { useAccent } from './lib/theme';
import styles from './App.module.css';

export function App() {
  const { accent, accentBg } = useAccent();
  const vars = { '--accent': accent, '--accent-bg': accentBg } as CSSProperties;

  return (
    <div className={styles.app} style={vars}>
      <Rail />
      <div className={styles.main}>
        <TopStrip />
        <Feed />
        <InputBar />
      </div>
      <Drawer />
      <Lightbox />
    </div>
  );
}
