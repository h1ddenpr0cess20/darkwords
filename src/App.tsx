import type { CSSProperties } from 'react';
import { useAppStore } from './store/useAppStore';
import { Rail } from './components/Rail';
import { TopStrip } from './components/TopStrip';
import { Feed } from './components/Feed';
import { InputBar } from './components/InputBar';
import { Drawer } from './components/drawer/Drawer';
import { Lightbox } from './components/Lightbox';
import { DesktopTitlebar } from './components/DesktopTitlebar';
import { useAccent } from './lib/theme';
import { isDesktopApp, TITLEBAR_HEIGHT } from './lib/desktop';
import styles from './App.module.css';

export function App() {
  const { accent, accentBg } = useAccent();
  const fontScale = useAppStore((s) => s.fontScale);
  const desktop = isDesktopApp();
  const vars = {
    '--accent': accent,
    '--accent-bg': accentBg,
    '--font-scale': fontScale,
    ...(desktop && {
      '--titlebar-height': `${TITLEBAR_HEIGHT}px`,
      paddingTop: TITLEBAR_HEIGHT,
    }),
  } as CSSProperties;

  return (
    <div className={styles.app} style={vars}>
      <DesktopTitlebar />
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
