/**
 * Human-friendly age of a timestamp for the History panel — relative wording
 * for the recent past, then clock time, then dates.
 */
export function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
