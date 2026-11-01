import { formatDay, formatTime } from "./format";

export interface SyncState {
  /** When the worklist was last read live, in epoch milliseconds. */
  liveAt: number | null;
  /** When the stored copy was synced, ISO 8601. */
  syncedAt: string | null;
  /** Why the last Mac sync did not finish, if it did not. */
  error?: string | null;
}

export interface SyncLabel {
  text: string;
  title: string;
  tone: "normal" | "err";
}

/** A live read is "live" for three minutes. */
const LIVE_FOR = 3 * 60000;

/**
 * What the header says about freshness: "Live" while the worklist is read
 * from the local server, otherwise when the stored copy was synced.
 */
export function syncLabel(state: SyncState, now: Date): SyncLabel {
  const live = state.liveAt !== null && now.getTime() - state.liveAt < LIVE_FOR;
  const last = state.syncedAt ? new Date(state.syncedAt) : null;
  const text = live
    ? "Live"
    : last && !Number.isNaN(last.getTime())
      ? `Synced ${formatDay(last) === formatDay(now) ? "" : `${formatDay(last)} `}${formatTime(last)}`
      : "Not synced yet";
  if (state.error) {
    return {
      text,
      title: `The last Mac sync didn't finish: ${state.error}`,
      tone: "err",
    };
  }
  return {
    text,
    title: live
      ? "Updating by itself while this page is open in the Claude desktop app on your Mac"
      : "A stored copy; it updates while the page is open in the Claude desktop app on your Mac",
    tone: "normal",
  };
}
