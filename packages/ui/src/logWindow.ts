/**
 * The window the log reads through: the last 24 hours, every line stamped
 * with its time of day alone. Within one day a date adds nothing, so the
 * clock is the whole stamp. Pure functions, so the cut-off and the format
 * are tested without a browser.
 */

/** How far back the log reaches, in milliseconds: 24 hours. */
export const logWindowMilliseconds = 24 * 60 * 60 * 1000;

/**
 * The lines no older than 24 hours before `now`, in the order given. A line
 * stamped after `now`, from a clock running ahead, stays in.
 */
export function withinLogWindow<Line extends { time: Date }>(
  lines: readonly Line[],
  now: Date,
): Line[] {
  const since = now.getTime() - logWindowMilliseconds;
  return lines.filter((line) => line.time.getTime() >= since);
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

/**
 * A line's time of day on the 24-hour clock, in the reader's time zone:
 * "15:55:50", or "15:55" without seconds. Never a date.
 */
export function logClock(time: Date, seconds = true): string {
  const clock = `${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`;
  return seconds ? `${clock}:${twoDigits(time.getSeconds())}` : clock;
}
