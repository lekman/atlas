import {
  foldKeys,
  QUADRANTS,
  wallTime,
  type CalendarEvent,
  type WorkItem,
} from "@atlas/ui/sidebar";

/**
 * The fold keys after "Collapse to clients" or "Expand all": every client
 * group in Today, Tomorrow and the backlog's quadrants closed, or all
 * open. Quadrants themselves stay open either way.
 */
export function foldAll(
  folded: ReadonlySet<string>,
  clients: readonly string[],
  collapse: boolean,
): Set<string> {
  const all = [...clients, "other"];
  const quadrantKey = /^(q:|(Q[1-4]-[a-z-]+|unsized)\|)/;
  const next = new Set(
    [...folded].filter((k) => !quadrantKey.test(k) && !all.includes(k)),
  );
  if (collapse) {
    for (const c of all) {
      next.add(foldKeys.client(c));
      for (const q of QUADRANTS) next.add(foldKeys.quadrantClient(q.key, c));
    }
  }
  return next;
}

/** The first visit to the backlog: quadrants open, each client group inside them closed. */
export function planFolds(
  folded: ReadonlySet<string>,
  clients: readonly string[],
): Set<string> {
  const next = new Set(
    [...folded].filter((k) => !/^(q:|(Q[1-4]-[a-z-]+|unsized)\|)/.test(k)),
  );
  for (const q of QUADRANTS)
    for (const c of [...clients, "other"])
      next.add(foldKeys.quadrantClient(q.key, c));
  return next;
}

/** Meetings the planner wrote into the worklist, as calendar events in the home time zone. */
export function worklistMeetings(
  items: readonly WorkItem[],
  home: string,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const t of items) {
    if (!t.meeting || !t.day) continue;
    const at = (time: string) =>
      wallTime(`${t.day}T${time.padStart(5, "0")}:00`, home, home);
    const start = at(t.meeting.start);
    if (!start) continue;
    out.push({
      client: t.customer,
      via: "Dashboard.md",
      title: t.title,
      start,
      end: at(t.meeting.end) ?? start,
      allDay: false,
    });
  }
  return out;
}
