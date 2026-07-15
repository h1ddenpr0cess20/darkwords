/**
 * Stroke icons shared across surfaces, so a glyph is drawn once instead of
 * hand-copied per call site. They inherit `currentColor` unless a stroke is
 * passed, and never shrink inside flex rows.
 */

interface IconProps {
  size?: number;
  stroke?: string;
}

export function DownloadIcon({ size = 15, stroke = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function PlayIcon({ size = 14, stroke = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke} stroke="none" style={{ flex: 'none' }}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function PauseIcon({ size = 14, stroke = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke} stroke="none" style={{ flex: 'none' }}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function StopIcon({ size = 14, stroke = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke} stroke="none" style={{ flex: 'none' }}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

export function CloseIcon({ size = 15, stroke = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      style={{ flex: 'none' }}
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
