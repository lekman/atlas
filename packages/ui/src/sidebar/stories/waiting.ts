/** Invented asks for the stories, one of each kind. */
import type { WaitingItem } from "../waiting/model";

/** The invented operator the asks are addressed to. */
export const OPERATOR = "Alex";

export const waitingItems: WaitingItem[] = [
  {
    kind: "task",
    ref: "kestrel-42",
    customer: "kestrel",
    ask: "Alex: approve the cut-over window for Saturday",
    title: "Move the depot scanners to the new API",
    since: "2026-03-10T09:00:00",
  },
  {
    kind: "commander",
    worker: "Halcyon",
    ask: "Pipeline green on staging; Alex to confirm the release notes before production",
    since: "2026-03-12T08:20:00",
  },
  {
    kind: "question",
    ask: "Which client should the free Friday afternoon go to?",
  },
];
