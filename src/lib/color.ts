/** `#RRGGBB` → `"r, g, b"`, ready to drop into an `rgba(…, alpha)` expression. */
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
