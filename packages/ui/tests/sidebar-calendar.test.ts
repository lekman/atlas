import { describe, expect, it } from "bun:test";

import {
  agendaDays,
  feedEvents,
  googleEvents,
  mergeEvents,
  nextEvent,
  outlookEvents,
  outlookTime,
  upcomingCount,
  wallTime,
  type CalendarEvent,
} from "../src/sidebar";

const HOME = "Europe/London";
const classify = (title: string, fallback: string) =>
  /acme/i.test(title) ? "acme" : fallback;
const at = (iso: string) => new Date(iso);

describe("wallTime and outlookTime", () => {
  it("reads a wall-clock time in its zone, summer time included", () => {
    expect(
      wallTime("2026-01-15T09:00:00", "GMT Standard Time", HOME)?.toISOString(),
    ).toBe("2026-01-15T09:00:00.000Z");
    expect(
      wallTime("2026-07-15T09:00:00", "GMT Standard Time", HOME)?.toISOString(),
    ).toBe("2026-07-15T08:00:00.000Z");
    expect(
      wallTime(
        "2026-07-15T09:00:00",
        "Eastern Standard Time",
        HOME,
      )?.toISOString(),
    ).toBe("2026-07-15T13:00:00.000Z");
  });

  it("falls back to the home zone for a zone it doesn't know", () => {
    expect(
      wallTime(
        "2026-07-15T09:00:00",
        "Mars Standard Time",
        HOME,
      )?.toISOString(),
    ).toBe("2026-07-15T08:00:00.000Z");
  });

  it("takes UTC as UTC and drops fractions of a second", () => {
    expect(
      outlookTime(
        { dateTime: "2026-07-15T09:00:00.0000000", timeZone: "UTC" },
        HOME,
      )?.toISOString(),
    ).toBe("2026-07-15T09:00:00.000Z");
    expect(outlookTime(undefined, HOME)).toBeNull();
  });
});

describe("googleEvents", () => {
  const options = { client: "home", via: "Home calendar", classify };

  it("skips cancelled and declined events and reads all-day ones", () => {
    const events = googleEvents(
      {
        events: [
          {
            summary: "Acme review",
            start: { dateTime: "2026-03-12T10:00:00Z" },
            end: { dateTime: "2026-03-12T11:00:00Z" },
            attendees: [{ self: true, responseStatus: "accepted" }, {}],
            hangoutLink: "https://meet.example/x",
          },
          {
            summary: "Cancelled",
            status: "cancelled",
            start: { dateTime: "2026-03-12T10:00:00Z" },
          },
          {
            summary: "Declined",
            start: { dateTime: "2026-03-12T10:00:00Z" },
            attendees: [{ self: true, responseStatus: "declined" }],
          },
          {
            summary: "Holiday",
            start: { date: "2026-03-13" },
            end: { date: "2026-03-14" },
          },
          { summary: "Broken", start: {} },
        ],
      },
      options,
    );
    expect(events.map((e) => [e.title, e.client, e.allDay])).toEqual([
      ["Acme review", "acme", false],
      ["Holiday", "home", true],
    ]);
    expect(events[0]).toMatchObject({ join: "https://meet.example/x", who: 2 });
  });
});

describe("outlookEvents", () => {
  const options = {
    client: "home",
    via: "Work calendar",
    classify,
    home: HOME,
  };

  it("reads one JSON text block per item, and skips cancelled ones", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: "1",
            subject: "Acme call",
            start: {
              dateTime: "2026-07-15T09:00:00",
              timeZone: "GMT Standard Time",
            },
            end: {
              dateTime: "2026-07-15T09:30:00",
              timeZone: "GMT Standard Time",
            },
            location: { displayName: "Room 2" },
            webLink: "https://outlook.example/1",
            attendees: [{}, {}, {}],
          }),
        },
        {
          type: "text",
          text: JSON.stringify({
            id: "2",
            subject: "Gone",
            isCancelled: true,
            start: { dateTime: "2026-07-15T10:00:00", timeZone: "UTC" },
          }),
        },
        { type: "text", text: "Found 2 events" },
      ],
    };
    const events = outlookEvents(result, options);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      client: "acme",
      where: "Room 2",
      who: 3,
      link: "https://outlook.example/1",
    });
    expect(events[0]!.start.toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("reads a payload when there are no text blocks", () => {
    const events = outlookEvents(
      {
        payload: {
          value: [
            {
              id: "1",
              subject: "S",
              start: { dateTime: "2026-07-15T09:00:00", timeZone: "UTC" },
            },
          ],
        },
      },
      options,
    );
    expect(events.map((e) => e.title)).toEqual(["S"]);
  });
});

describe("feedEvents", () => {
  it("names the feed, and reads titles in a mixed feed", () => {
    const events = feedEvents(
      [
        {
          customer: "home",
          title: "Acme planning",
          start: "2026-03-12T10:00:00Z",
        },
        { customer: "home", title: "Accounts", start: "2026-03-12T11:00:00Z" },
        { customer: "nobody", title: "X", start: "2026-03-12T12:00:00Z" },
        { title: "No start" },
      ],
      {
        known: (k) => k === "home" || k === "acme",
        nameOf: (k) => (k === "home" ? "Home" : "Other"),
        mixed: ["home"],
        classify,
      },
    );
    expect(events.map((e) => [e.client, e.via])).toEqual([
      ["acme", "Home feed"],
      ["home", "Home feed"],
      ["other", "Other feed"],
    ]);
  });
});

const ev = (
  title: string,
  start: string,
  end: string,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  client: "home",
  via: "x",
  title,
  start: at(start),
  end: at(end),
  allDay: false,
  ...extra,
});

describe("mergeEvents", () => {
  const now = at("2026-03-12T09:40:00");

  it("keeps one of the same start and title, all-day first, then by start", () => {
    const merged = mergeEvents(
      [
        [ev("Review", "2026-03-12T14:00:00", "2026-03-12T15:00:00")],
        [
          ev("review!", "2026-03-12T14:00:00", "2026-03-12T15:00:00"),
          ev("Stand-up", "2026-03-12T09:30:00", "2026-03-12T09:45:00"),
        ],
        [
          ev("Off", "2026-03-13T00:00:00", "2026-03-14T00:00:00", {
            allDay: true,
          }),
        ],
      ],
      now,
    );
    expect(merged.map((e) => e.title)).toEqual(["Off", "Stand-up", "Review"]);
  });

  it("adds placeholders for a client with no events, weekdays only", () => {
    const merged = mergeEvents([[]], now, "acme");
    expect(merged.every((e) => e.sample && e.client === "acme")).toBe(true);
    expect(
      merged.some((e) => e.start.getDay() === 0 || e.start.getDay() === 6),
    ).toBe(false);
    expect(
      mergeEvents(
        [
          [
            ev("Real", "2026-03-12T10:00:00", "2026-03-12T11:00:00", {
              client: "acme",
            }),
          ],
        ],
        now,
        "acme",
      ),
    ).toHaveLength(1);
  });
});

describe("the week", () => {
  const now = at("2026-03-12T09:40:00");
  const events = [
    ev("Stand-up", "2026-03-12T09:30:00", "2026-03-12T09:45:00"),
    ev("Review", "2026-03-12T14:00:00", "2026-03-12T15:00:00"),
    ev("Late", "2026-03-12T23:30:00", "2026-03-13T00:30:00"),
    ev("Away", "2026-03-20T09:00:00", "2026-03-20T10:00:00"),
  ];

  it("lists seven days, with each day's timed events and minutes within it", () => {
    const days = agendaDays(events, now);
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({
      label: "Today",
      timed: 3,
      minutes: 15 + 60 + 30,
    });
    expect(days[1]).toMatchObject({ label: "Tomorrow", timed: 1, minutes: 30 });
    expect(days[2]!.label).toBe("Saturday");
  });

  it("finds the meeting under way, else the next one", () => {
    expect(nextEvent(events, now)).toMatchObject({
      state: "now",
      event: { title: "Stand-up" },
    });
    expect(nextEvent(events, at("2026-03-12T10:00:00"))).toMatchObject({
      state: "next",
      event: { title: "Review" },
    });
    expect(nextEvent([], now)).toBeNull();
  });

  it("counts timed events still to come within the week", () => {
    expect(upcomingCount(events, now)).toBe(3);
  });
});
