/**
 * Dates as the day plan writes them. Plans are kept as ISO days, so they
 * are read at noon UTC: no time zone can move one onto the day before.
 */
const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);

/** "Monday 19 October". */
export function longDay(day: string): string {
  return atNoon(day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** "Fri 16 Oct". */
export function shortDay(day: string): string {
  return atNoon(day).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Whole days from one ISO day to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (atNoon(to).getTime() - atNoon(from).getTime()) / 86_400_000,
  );
}
