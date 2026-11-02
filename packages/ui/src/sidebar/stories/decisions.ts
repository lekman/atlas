/** Invented repeated asks, rules and guards for the Teach Commander stories. */
import type { DecisionRule, Guard, RepeatedAsk } from "../decisions/model";

export const guards: Guard[] = [
  {
    category: "Production",
    why: "A deploy or change to production waits for you, whatever Commander learned.",
  },
  {
    category: "Money",
    why: "Anything that spends, invoices or changes a price.",
  },
  {
    category: "Posting as you",
    why: "Comments, reviews or messages under your name are yours to write.",
  },
];

export const repeatedAsks: RepeatedAsk[] = [
  {
    pattern: "dependabot-patch-green",
    ask: "A Dependabot patch bump is green. Merge it?",
    from: "Halcyon",
    answers: [
      { answer: "Merge", on: "2026-03-02T09:10:00" },
      { answer: "Merge", on: "2026-03-04T10:00:00" },
      { answer: "merge", on: "2026-03-06T08:40:00" },
      { answer: "Merge", on: "2026-03-09T11:20:00" },
      { answer: "Merge", on: "2026-03-11T15:05:00" },
    ],
  },
  {
    pattern: "idle-worker-next-task",
    ask: "Kestrel's worker is idle with planned work. Start the next task?",
    from: "Commander",
    answers: [
      { answer: "Yes, run /planner:next", on: "2026-03-05T09:00:00" },
      { answer: "Yes, run /planner:next", on: "2026-03-09T09:02:00" },
      { answer: "Wait for me", on: "2026-03-10T09:01:00" },
      { answer: "Yes, run /planner:next", on: "2026-03-11T09:00:00" },
      { answer: "Yes, run /planner:next", on: "2026-03-12T09:00:00" },
    ],
  },
  {
    pattern: "friday-afternoon-client",
    ask: "Which client should the free Friday afternoon go to?",
    from: "Commander",
    answers: [
      { answer: "Kestrel", on: "2026-02-20T12:00:00" },
      { answer: "Meridian", on: "2026-02-27T12:00:00" },
      { answer: "Kestrel", on: "2026-03-06T12:00:00" },
    ],
  },
  {
    pattern: "release-to-production",
    ask: "Staging is green. Release to production?",
    from: "Halcyon",
    touches: ["Production"],
    answers: [
      { answer: "Go", on: "2026-03-03T14:00:00" },
      { answer: "Go", on: "2026-03-10T14:00:00" },
      { answer: "Go", on: "2026-03-11T16:00:00" },
    ],
  },
  {
    pattern: "rename-session",
    ask: "Two sessions share the name Builder. Rename one?",
    from: "Commander",
    answers: [{ answer: "Rename the newer one", on: "2026-03-08T10:00:00" }],
  },
];

export const rules: DecisionRule[] = [
  {
    id: "rule-merge-blocker",
    pattern: "approved-blocker",
    when: "An approved PR blocks another",
    then: "Merge it and update the waiting branch",
    mode: "decide",
    used: 7,
    lastUsed: "2026-03-11T13:30:00",
  },
  {
    id: "rule-nudge",
    pattern: "worker-idle-no-reply",
    when: "A worker has not answered a handoff for 10 minutes",
    then: "Nudge it once",
    mode: "decide-and-tell",
    used: 12,
    lastUsed: "2026-03-12T08:50:00",
  },
];
