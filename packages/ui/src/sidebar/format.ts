/** Times and durations as the sidebar writes them, in British English. */

export const formatTime = (d: Date): string =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const formatDay = (d: Date): string =>
  d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export const formatToday = (d: Date): string =>
  d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

/** A length of time: "45 min", "2 h 5 min", "3 days". */
export function formatDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  if (hours < 24) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""}`;
}

/** How long ago, in a phrase: "just now", "5m ago", "on 18 Oct". */
export function formatAgo(then: Date, now: Date): string {
  const m = Math.round((now.getTime() - then.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const hours = Math.round(m / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `on ${then.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}
