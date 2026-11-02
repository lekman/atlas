/**
 * Calendar events from the sidebar's sources, merged into one week. Each
 * source names which client an event belongs to; where it can't, the
 * caller's `classify` reads the title.
 */
import { safeUrl } from "../trackers/model";

export interface CalendarEvent {
  /** The client key it belongs to. */
  client: string;
  /** Where it came from, shown under the event. */
  via: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  link?: string | null;
  join?: string | null;
  where?: string | null;
  /** How many people are invited. */
  who?: number;
  /** A placeholder until a client's real calendar is connected. */
  sample?: boolean;
}

export interface SourceOptions {
  /** The client the source belongs to, when the title names none. */
  client: string;
  via: string;
  classify: (title: string, fallback: string) => string;
}

const isValid = (d: Date) => !Number.isNaN(d.getTime());

// ---------- Google Calendar ----------

interface GoogleEvent {
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
  htmlLink?: string;
  conferenceUrl?: string;
  hangoutLink?: string;
  location?: string;
}

/** Events from the Google Calendar connector, without cancelled or declined ones. */
export function googleEvents(
  payload: unknown,
  options: SourceOptions,
): CalendarEvent[] {
  const list = (payload as { events?: unknown } | null)?.events;
  const out: CalendarEvent[] = [];
  for (const e of Array.isArray(list) ? (list as GoogleEvent[]) : []) {
    if (!e || e.status === "cancelled") continue;
    if (e.attendees?.find((a) => a.self)?.responseStatus === "declined")
      continue;
    const allDay = Boolean(e.start?.date && !e.start.dateTime);
    const start = allDay
      ? new Date(`${e.start!.date}T00:00:00`)
      : new Date(e.start?.dateTime ?? NaN);
    const end = allDay
      ? new Date(`${e.end?.date ?? e.start!.date}T00:00:00`)
      : new Date(e.end?.dateTime ?? NaN);
    if (!isValid(start)) continue;
    out.push({
      client: options.classify(e.summary ?? "", options.client),
      via: options.via,
      title: e.summary || "(no title)",
      start,
      end: isValid(end) ? end : start,
      allDay,
      link: safeUrl(e.htmlLink),
      join: safeUrl(e.conferenceUrl ?? e.hangoutLink),
      where: e.location || null,
      who: e.attendees?.length ?? 0,
    });
  }
  return out;
}

// ---------- Outlook ----------

/** Windows time zone names Outlook sends, as IANA names. */
const WINDOWS_ZONES: Record<string, string> = {
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "Eastern Standard Time": "America/New_York",
  "Pacific Standard Time": "America/Los_Angeles",
};

/** How far a time zone is ahead of UTC at a moment, in milliseconds. */
function zoneOffset(at: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return (
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    ) - at.getTime()
  );
}

/**
 * A wall-clock time ("2026-03-12T09:30:00") in a time zone, Windows or
 * IANA, as a moment. An unknown zone falls back to `home`.
 */
export function wallTime(
  wall: string,
  zone: string | undefined,
  home: string,
): Date | null {
  let tz = (zone && WINDOWS_ZONES[zone]) || zone || home;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = home;
  }
  const guess = new Date(`${wall}Z`);
  if (!isValid(guess)) return null;
  return new Date(guess.getTime() - zoneOffset(guess, tz));
}

interface OutlookTime {
  dateTime?: string;
  timeZone?: string;
}

export function outlookTime(
  t: OutlookTime | undefined,
  home: string,
): Date | null {
  if (!t?.dateTime) return null;
  const wall = String(t.dateTime)
    .replace(/\.\d+$/, "")
    .replace(/Z$/, "");
  if (/^(utc|coordinated universal time)$/i.test(t.timeZone ?? "")) {
    const d = new Date(`${wall}Z`);
    return isValid(d) ? d : null;
  }
  return wallTime(wall, t.timeZone, home);
}

interface OutlookEvent {
  id?: unknown;
  isCancelled?: boolean;
  subject?: string;
  start?: OutlookTime;
  end?: OutlookTime;
  isAllDay?: boolean;
  location?: string | { displayName?: string };
  webLink?: string;
  attendees?: unknown[];
}

/** The Microsoft 365 tools answer with one JSON text block per item, or a payload. */
function outlookItems(result: unknown): OutlookEvent[] {
  const r = (result ?? {}) as { content?: unknown; payload?: unknown };
  const out: OutlookEvent[] = [];
  for (const block of Array.isArray(r.content) ? r.content : []) {
    const b = block as { type?: unknown; text?: unknown };
    if (b?.type !== "text" || typeof b.text !== "string") continue;
    try {
      const j: unknown = JSON.parse(b.text);
      if (Array.isArray(j)) out.push(...(j as OutlookEvent[]));
      else out.push(j as OutlookEvent);
    } catch {
      // A text block that isn't an item: a heading or a note.
    }
  }
  if (!out.length && r.payload) {
    const p = r.payload as { value?: unknown };
    if (Array.isArray(p)) out.push(...(p as OutlookEvent[]));
    else if (Array.isArray(p.value)) out.push(...(p.value as OutlookEvent[]));
    else out.push(p as OutlookEvent);
  }
  return out.filter((x) => x && typeof x === "object" && x.id);
}

/** Events from the Microsoft 365 connector's calendar search, the raw result. */
export function outlookEvents(
  result: unknown,
  options: SourceOptions & { home: string },
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of outlookItems(result)) {
    if (e.isCancelled) continue;
    const start = outlookTime(e.start, options.home);
    if (!start) continue;
    const end = outlookTime(e.end, options.home);
    const where =
      typeof e.location === "string" ? e.location : e.location?.displayName;
    out.push({
      client: options.classify(e.subject ?? "", options.client),
      via: options.via,
      title: e.subject || "(no title)",
      start,
      end: end ?? start,
      allDay: Boolean(e.isAllDay),
      link: safeUrl(e.webLink),
      where: where || null,
      who: Array.isArray(e.attendees) ? e.attendees.length : 0,
    });
  }
  return out;
}

// ---------- client feeds ----------

export interface FeedItem {
  customer?: string;
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  link?: string;
  location?: string;
}

/**
 * Client calendar feeds, as the Mac's sync stores them at `board/events`.
 * A feed listed in `mixed` carries other clients' work too, so its titles
 * are read for the client.
 */
export function feedEvents(
  items: unknown,
  options: {
    known: (key: string) => boolean;
    nameOf: (key: string) => string;
    mixed: readonly string[];
    classify: (title: string, fallback: string) => string;
  },
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of Array.isArray(items) ? (items as FeedItem[]) : []) {
    const start = new Date(e?.start ?? NaN);
    if (!isValid(start)) continue;
    const end = new Date(e.end ?? e.start ?? NaN);
    const base = e.customer && options.known(e.customer) ? e.customer : "other";
    out.push({
      client: options.mixed.includes(base)
        ? options.classify(String(e.title ?? ""), base)
        : base,
      via: `${options.nameOf(base)} feed`,
      title: String(e.title || "(no title)"),
      start,
      end: isValid(end) ? end : start,
      allDay: Boolean(e.allDay),
      link: safeUrl(e.link),
      where: e.location ? String(e.location) : null,
    });
  }
  return out;
}

// ---------- the week ----------

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * Placeholder meetings for a client without a calendar: a stand-up each
 * weekday, a sync on Tuesdays, a review on Thursdays.
 */
export function sampleEvents(now: Date, client: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const t0 = startOfDay(now);
  for (let i = 0; i < 7; i++) {
    const d = addDays(t0, i);
    const weekday = d.getDay();
    if (weekday === 0 || weekday === 6) continue;
    const at = (h: number, m: number) => {
      const x = new Date(d);
      x.setHours(h, m, 0, 0);
      return x;
    };
    const event = (title: string, start: Date, end: Date): CalendarEvent => ({
      client,
      sample: true,
      via: "sample",
      title,
      start,
      end,
      allDay: false,
    });
    out.push(event("Team stand-up", at(9, 30), at(9, 45)));
    if (weekday === 2) out.push(event("Platform sync", at(11, 0), at(11, 45)));
    if (weekday === 4) out.push(event("Sprint review", at(14, 0), at(15, 0)));
  }
  return out;
}

/**
 * Every source's events, once each: the same start and title from two
 * sources is one event. Placeholders join for `sampleClient` when no
 * source has an event for it. All-day events first, then by start.
 */
export function mergeEvents(
  sources: ReadonlyArray<readonly CalendarEvent[]>,
  now: Date,
  sampleClient?: string,
): CalendarEvent[] {
  const seen = new Set<string>();
  const events: CalendarEvent[] = [];
  for (const e of sources.flat()) {
    const key = `${e.start.getTime()}|${e.title.toLowerCase().replace(/\W+/g, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(e);
  }
  if (sampleClient && !events.some((e) => e.client === sampleClient)) {
    events.push(...sampleEvents(now, sampleClient));
  }
  return events.sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      a.start.getTime() - b.start.getTime(),
  );
}

export interface AgendaDay {
  /** "Today", "Tomorrow", or the weekday. */
  label: string;
  date: Date;
  events: CalendarEvent[];
  /** Timed events, and the minutes they fill within the day. */
  timed: number;
  minutes: number;
}

/** The next seven days, each with the events that touch it. */
export function agendaDays(
  events: readonly CalendarEvent[],
  now: Date,
): AgendaDay[] {
  const t0 = startOfDay(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d0 = addDays(t0, i);
    const d1 = addDays(t0, i + 1);
    const todays = events.filter(
      (e) =>
        (e.start < d1 && e.end > d0) ||
        (e.start.getTime() === e.end.getTime() &&
          e.start >= d0 &&
          e.start < d1),
    );
    const timed = todays.filter((e) => !e.allDay);
    const minutes = timed.reduce(
      (sum, e) =>
        sum +
        Math.max(
          0,
          (Math.min(e.end.getTime(), d1.getTime()) -
            Math.max(e.start.getTime(), d0.getTime())) /
            60000,
        ),
      0,
    );
    return {
      label:
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : d0.toLocaleDateString("en-GB", { weekday: "long" }),
      date: d0,
      events: todays,
      timed: timed.length,
      minutes,
    };
  });
}

/** The meeting under way, or else the next one, among timed events. */
export function nextEvent(
  events: readonly CalendarEvent[],
  now: Date,
): { state: "now" | "next"; event: CalendarEvent } | null {
  const timed = events.filter((e) => !e.allDay);
  const live = timed.find((e) => e.start <= now && e.end > now);
  if (live) return { state: "now", event: live };
  const next = timed.find((e) => e.start > now);
  return next ? { state: "next", event: next } : null;
}

/** The calendar tab's count: timed events still to come this week. */
export function upcomingCount(
  events: readonly CalendarEvent[],
  now: Date,
): number {
  const t7 = addDays(startOfDay(now), 7);
  return events.filter((e) => !e.allDay && e.end > now && e.start < t7).length;
}
