/** An invented week for the calendar stories. */
import { agendaDays, mergeEvents, type CalendarEvent } from "../calendar/model";
import { STORY_NOW } from "./examples";

const on = (dayOffset: number, h: number, m: number) => {
  const d = new Date(STORY_NOW);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
};

const ev = (
  client: string,
  title: string,
  day: number,
  from: [number, number],
  to: [number, number],
  extra: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  client,
  via: client === "ashgrove" ? "Ashgrove calendar" : "Kestrel Freight feed",
  title,
  start: on(day, ...from),
  end: on(day, ...to),
  allDay: false,
  ...extra,
});

export const weekEvents: CalendarEvent[] = mergeEvents(
  [
    [
      ev("ashgrove", "Inbox and planning", 0, [8, 30], [9, 0]),
      ev("kestrel", "Depot cut-over stand-up", 0, [9, 30], [10, 0], {
        join: "https://meet.example/kf",
        who: 6,
      }),
      ev("meridian", "Access review with security", 0, [13, 0], [14, 0], {
        via: "Ashgrove calendar",
        where: "Meridian HQ, room 4",
        who: 4,
      }),
      ev("kestrel", "Release go/no-go", 1, [11, 0], [11, 30], { who: 8 }),
      {
        client: "ashgrove",
        via: "Ashgrove calendar",
        title: "Company holiday",
        start: on(4, 0, 0),
        end: on(5, 0, 0),
        allDay: true,
      },
    ],
  ],
  STORY_NOW,
  "halcyon",
);

export const weekDays = agendaDays(weekEvents, STORY_NOW);
