/** Helpers the tracker lists share. */

/** A link the sidebar opens: only `https://`, anything else is dropped. */
export const safeUrl = (url: unknown): string | null =>
  typeof url === "string" && /^https:\/\//i.test(url) ? url : null;

export type Priority = "high" | "medium" | "low" | "";

/** A tracker's priority word as one of the sidebar's three dots. */
export function priorityOf(
  word: string | null | undefined,
  high: RegExp = /critical|high/i,
): Priority {
  if (!word) return "";
  if (high.test(word)) return "high";
  if (/medium/i.test(word)) return "medium";
  return "low";
}
