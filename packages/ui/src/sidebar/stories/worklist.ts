/** An invented worklist for the stories: today, tomorrow and the backlog. */
import type { WorkItem } from "../worklist/model";

export const STORY_TODAY = "2026-03-12";
export const STORY_TOMORROW = "2026-03-13";

let n = 0;
const item = (
  customer: string,
  title: string,
  more: Partial<WorkItem>,
): WorkItem => ({
  ref: `db:${++n}`,
  customer,
  title,
  order: n,
  ...more,
});

const today = { band: "today" as const, day: STORY_TODAY };
const tomorrow = { band: "tomorrow" as const, day: STORY_TOMORROW };
const later = { band: "future" as const, day: "2026-03-19" };
const unplanned = { band: "unscheduled" as const };

export const worklistItems: WorkItem[] = [
  item("kestrel", "Cut the depots over to the new scanner API", {
    ...today,
    priority: "high",
    key: "KF-301",
    flags: ["active"],
    value: "high",
    effort: "M",
    quadrant: "Q1-do-now",
    claimedBy: "kestrel-ops",
  }),
  item("kestrel", "Confirm the release notes with the depot leads", {
    ...today,
    priority: "medium",
    value: "medium",
    effort: "S",
    quadrant: "Q1-do-now",
  }),
  item("kestrel", "Route planner timeout", {
    ...today,
    priority: "high",
    key: "KF-296",
    flags: ["approved"],
    value: "high",
    effort: "S",
    quadrant: "Q1-do-now",
  }),
  item("kestrel", "Archive last year's delivery notes", {
    ...today,
    done: true,
    priority: "low",
  }),
  item("halcyon", "Answer the consent screen question", {
    ...today,
    priority: "high",
    flags: ["blocked"],
    value: "high",
    effort: "XS",
    quadrant: "Q1-do-now",
  }),
  item("halcyon", "Draft the data retention wording", {
    ...today,
    priority: "medium",
    value: "medium",
    effort: "M",
    quadrant: "Q2-schedule",
  }),
  item("meridian", "Rotate the signing key on staging", {
    ...today,
    priority: "high",
    key: "#409",
    value: "high",
    effort: "S",
    quadrant: "Q1-do-now",
  }),
  item("meridian", "Review the access log export", {
    ...today,
    priority: "low",
  }),
  item("ashgrove", "Send the March invoices", {
    ...today,
    priority: "medium",
    value: "medium",
    effort: "XS",
    quadrant: "Q3-minimise",
  }),
  item("ashgrove", "Tidy the notes from Monday", { ...today, priority: "low" }),
  item("ashgrove", "Book the accountant", { ...today, priority: "low" }),
  item("ashgrove", "Renew the domain", { ...today, priority: "low" }),
  item("ashgrove", "Back up the laptop", { ...today, priority: "low" }),
  item("ashgrove", "Order a new keyboard", { ...today, priority: "low" }),
  item("kestrel", "Prepare the go/no-go", {
    ...tomorrow,
    priority: "high",
    value: "high",
    effort: "S",
    quadrant: "Q1-do-now",
  }),
  item("halcyon", "Export the visit schedule as CSV", {
    ...tomorrow,
    priority: "medium",
    value: "medium",
    effort: "L",
    quadrant: "Q2-schedule",
  }),
  item("meridian", "Pin the base image digest", {
    ...later,
    priority: "medium",
    value: "medium",
    effort: "S",
    quadrant: "Q2-schedule",
  }),
  item("meridian", "Document the reconciliation job", {
    ...unplanned,
    priority: "low",
    value: "low",
    effort: "M",
    quadrant: "Q4-drop",
  }),
  item("halcyon", "Spike: offline mode for site visits", {
    ...unplanned,
    priority: "medium",
  }),
  item("ashgrove", "Write the spring newsletter", {
    ...unplanned,
    priority: "low",
    value: "low",
    effort: "S",
    quadrant: "Q3-minimise",
  }),
  {
    customer: "kestrel",
    title: "Depot stand-up",
    band: "today",
    day: STORY_TODAY,
    meeting: { start: "9:30", end: "9:45" },
  },
];
