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
    detail:
      "The new scanner API is live on staging and passed the depot trial. The cut-over needs a two-hour window with the depots closed; Saturday 06:00–08:00 is the only one this month.",
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
