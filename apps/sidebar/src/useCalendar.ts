import { describeError, type Runtime, type RuntimeError } from "@atlas/runtime";
import {
  feedEvents,
  googleEvents,
  mergeEvents,
  outlookEvents,
  type CalendarEvent,
} from "@atlas/ui/sidebar";
import { useMemo } from "react";

import { classify, type SidebarConfig } from "./config";
import { useFeed } from "./useFeed";

export interface Calendar {
  /** Every event of the week, merged; null until a calendar has answered. */
  events: CalendarEvent[] | null;
  /** What failed, in words, with the calendar it belongs to. */
  errors: Array<{ text: string; tone: "warn" | "err" }>;
  /** True when the placeholder client's meetings are placeholders. */
  usingSamples: boolean;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function errorOf(
  failure: RuntimeError | null,
  label: string,
  connector: string,
) {
  return failure
    ? {
        text: `${label}: ${describeError(failure, connector)}`,
        tone:
          failure.code === "server_unavailable"
            ? ("warn" as const)
            : ("err" as const),
      }
    : null;
}

/**
 * The week's calendar: Google and Outlook through their connectors every
 * five minutes, the client feeds the Mac's sync stores, and placeholders
 * for a client without a calendar. The watches restart each day, so the
 * week moves on.
 */
export function useCalendar(
  runtime: Runtime,
  config: SidebarConfig,
  feeds: unknown,
  now: Date,
  /** Meetings from other sources, as the worklist's. */
  more: readonly CalendarEvent[] = [],
): Calendar {
  const calendar = config.calendar;
  const today = dayKey(now);
  const t0 = startOfDay(now);
  const t7 = new Date(t0);
  t7.setDate(t7.getDate() + 7);
  const cls = (title: string, fallback: string) =>
    classify(title, fallback, config) ?? fallback;
  const watch = {
    refetchInterval: 5 * 60000,
    cache: { staleTime: 60000, gcTime: 6 * 3600000 },
  };

  const google = useFeed<CalendarEvent[]>(
    runtime,
    calendar?.google
      ? {
          server: "Google Calendar",
          tool: "list_events",
          args: {
            startTime: t0.toISOString(),
            endTime: t7.toISOString(),
            orderBy: "startTime",
            pageSize: 100,
          },
          accept: (d) =>
            googleEvents(d, {
              ...calendar.google!,
              via: calendar.google!.label,
              classify: cls,
            }),
          watch,
        }
      : null,
    "Google Calendar",
    today,
  );
  const outlook = useFeed<CalendarEvent[]>(
    runtime,
    calendar?.outlook
      ? {
          server: "Microsoft 365",
          tool: "outlook_calendar_search",
          args: {
            query: "*",
            afterDateTime: dayKey(t0),
            beforeDateTime: dayKey(t7),
            order: "oldest",
            limit: 25,
          },
          raw: true,
          accept: (d) =>
            outlookEvents(d, {
              ...calendar.outlook!,
              via: calendar.outlook!.label,
              classify: cls,
              home: calendar.timeZone,
            }),
          watch,
        }
      : null,
    "Microsoft 365",
    today,
  );

  const known = (key: string) => config.clients.some((c) => c.key === key);
  const nameOf = (key: string) =>
    config.clients.find((c) => c.key === key)?.name ?? "Other";
  const feedList = (feeds as { items?: unknown } | null)?.items;
  const fromFeeds = useMemo(
    () =>
      feedEvents(feedList, {
        known,
        nameOf,
        mixed: calendar?.mixedFeeds ?? [],
        classify: cls,
      }),
    // biome-ignore lint/correctness/useExhaustiveDependencies: the config is fixed for the page's life.
    [feedList],
  );

  // A calendar has answered when it gave events or failed; none configured counts as answered.
  const answered = (f: { data: unknown; failure: unknown }, on: boolean) =>
    !on || f.data !== null || f.failure !== null;
  const ready =
    !runtime.present ||
    answered(google, Boolean(calendar?.google)) ||
    answered(outlook, Boolean(calendar?.outlook));

  const events = useMemo(
    () =>
      ready
        ? mergeEvents(
            [google.data ?? [], outlook.data ?? [], fromFeeds, more],
            now,
            calendar?.samples?.client,
          )
        : null,
    // biome-ignore lint/correctness/useExhaustiveDependencies: placeholders follow the day, not each tick.
    [ready, google.data, outlook.data, fromFeeds, more, today],
  );

  return {
    events,
    errors: [
      errorOf(google.failure, calendar?.google?.label ?? "", "Google Calendar"),
      errorOf(outlook.failure, calendar?.outlook?.label ?? "", "Microsoft 365"),
    ].filter((e): e is { text: string; tone: "warn" | "err" } => e !== null),
    usingSamples: Boolean(events?.some((e) => e.sample)),
  };
}
