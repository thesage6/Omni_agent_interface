// Compact relative-time formatting shared across views. `fallback` is what a
// missing timestamp reads as — callers pick the word that fits their context
// ("unknown" for a session's last activity, "never" for a profile's last use).
export function timeAgo(value?: number | null, fallback = "unknown"): string {
  if (!value) return fallback;
  const seconds = Math.max(0, Math.round((Date.now() - value) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
