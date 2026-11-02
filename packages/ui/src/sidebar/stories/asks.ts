/** Invented asks with options, for the answer stories. */
import type { WaitingItem } from "../waiting/model";

export const supportAsk: WaitingItem = {
  kind: "commander",
  id: "dash-1",
  worker: "Halcyon",
  ask: "Connector port merged. Blocked: Alex to name Kestrel's support system and whether it has an API.",
  since: "2026-03-10T08:10:00",
  options: [
    {
      label: "Hold until the pilot sends",
      description:
        "Park the follow-up; service requests keep going by email only.",
      recommended: true,
    },
    {
      label: "Ask their IT lead",
      description: "The request stays waiting until they answer.",
    },
  ],
};

export const plainAsk: WaitingItem = {
  kind: "question",
  id: "q-7",
  ask: "Which client should the free Friday afternoon go to?",
};
