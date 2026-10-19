/**
 * The sample dataset with one client grown busy: Halcyon Labs carries about
 * a hundred backlog items over six workstreams, as a real client does after
 * a few months. Stories and tests use it to prove the map stays readable at
 * that scale.
 *
 * The items are generated, but from a fixed seed, so every run gives the
 * same titles, states, priorities and days. Every title is invented and
 * generic. See .claude/rules/client-content.md.
 */
import { Dataset, type BacklogItem, type Workstream } from "@atlas/core";

import { sampleDataset } from "./dataset";
import { sampleToday } from "./day-plan";

/** The client that is busy. */
export const busyClientId = "halcyon";

const confidential = {
  classification: "client-confidential",
  boundary: "home-server",
} as const;

/** The three workstreams added to the three Halcyon Labs already has. */
const addedWorkstreams: Workstream[] = [
  {
    id: "halcyon-data",
    clientId: busyClientId,
    title: "Data platform",
    order: 4,
    ...confidential,
  },
  {
    id: "halcyon-access",
    clientId: busyClientId,
    title: "Access and security",
    order: 5,
    ...confidential,
  },
  {
    id: "halcyon-reporting",
    clientId: busyClientId,
    title: "Reporting",
    order: 6,
    ...confidential,
  },
];

/**
 * What each workstream's work is about, and how much of it there is. The
 * shares are uneven on purpose: real workstreams are.
 */
const subjects: Array<{
  workstreamId: string | undefined;
  share: number;
  things: string[];
}> = [
  {
    workstreamId: "halcyon-go-live",
    share: 22,
    things: [
      "cut-over checklist",
      "rollback plan",
      "launch runbook",
      "go-live rota",
      "smoke tests",
      "release notes",
    ],
  },
  {
    workstreamId: "halcyon-quality",
    share: 16,
    things: [
      "flaky test list",
      "load test",
      "contract tests",
      "test data set",
      "coverage report",
      "browser tests",
    ],
  },
  {
    workstreamId: "halcyon-portal",
    share: 12,
    things: [
      "status page",
      "alert settings",
      "audit view",
      "user list",
      "search page",
      "help pages",
    ],
  },
  {
    workstreamId: "halcyon-data",
    share: 14,
    things: [
      "nightly export",
      "schema changes",
      "backup restore",
      "archive job",
      "data dictionary",
      "index tuning",
    ],
  },
  {
    workstreamId: "halcyon-access",
    share: 10,
    things: [
      "access review",
      "key rotation",
      "login audit",
      "role mapping",
      "secret scanning",
      "firewall rules",
    ],
  },
  {
    workstreamId: "halcyon-reporting",
    share: 8,
    things: [
      "weekly report",
      "usage dashboard",
      "cost summary",
      "uptime figures",
      "monthly review",
    ],
  },
  {
    workstreamId: undefined,
    share: 10,
    things: [
      "meeting notes",
      "onboarding guide",
      "team calendar",
      "tool licences",
      "vendor contacts",
    ],
  },
];

const verbs = [
  "Review",
  "Draft",
  "Update",
  "Test",
  "Document",
  "Automate",
  "Tidy",
  "Plan",
  "Measure",
  "Fix",
];

/** A small seeded generator (mulberry32), so the dataset never changes. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function generatedItems(count: number): BacklogItem[] {
  const random = seeded(2026);
  const pick = <Value>(values: readonly Value[]): Value =>
    values[Math.floor(random() * values.length)] as Value;
  const total = subjects.reduce((sum, subject) => sum + subject.share, 0);
  const used = new Set<string>();
  const items: BacklogItem[] = [];

  for (let index = 1; index <= count; index++) {
    let roll = random() * total;
    const subject =
      subjects.find((candidate) => (roll -= candidate.share) < 0) ??
      subjects[0]!;
    let title = "";
    do title = `${pick(verbs)} the ${pick(subject.things)}`;
    while (used.has(title));
    used.add(title);

    const stateRoll = random();
    const state: BacklogItem["state"] =
      stateRoll < 0.2
        ? "done"
        : stateRoll < 0.3
          ? "doing"
          : stateRoll < 0.36
            ? "review"
            : "todo";
    const priorityRoll = random();
    const priority: BacklogItem["priority"] =
      priorityRoll < 0.15 ? "high" : priorityRoll < 0.75 ? "normal" : "low";
    // Half the backlog not yet started has no day: it stays off the map.
    // Done work was planned for a day already past.
    const scheduled =
      state === "done"
        ? addDays(sampleToday, -1 - Math.floor(random() * 10))
        : state === "doing" || random() < 0.45
          ? addDays(sampleToday, Math.floor(random() * 16) - 4)
          : undefined;

    items.push({
      id: `halcyon-task-${String(index).padStart(3, "0")}`,
      clientId: busyClientId,
      ...(subject.workstreamId ? { workstreamId: subject.workstreamId } : {}),
      title,
      state,
      priority,
      ...(scheduled ? { scheduledFor: scheduled } : {}),
      ...(state === "done" && scheduled ? { doneOn: scheduled } : {}),
      ...confidential,
    });
  }
  return items;
}

/**
 * The sample dataset, with Halcyon Labs at about a hundred items: its own
 * five, and ninety-five generated across six workstreams and unsorted.
 */
export const busyDataset: Dataset = Dataset.parse({
  ...sampleDataset,
  workstreams: [...sampleDataset.workstreams, ...addedWorkstreams],
  items: [...sampleDataset.items, ...generatedItems(95)],
});
