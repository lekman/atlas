/** An invented details page for the stories, with every block a note may have. */
import type { DetailsPage } from "../details/model";
import type { WorkItem } from "../worklist/model";
import { STORY_NOW } from "./examples";

export const detailsItem: WorkItem = {
  ref: "db:42",
  title: "Cut the depots over to the new scanner API",
  customer: "kestrel",
  band: "today",
  day: "2026-03-12",
  priority: "high",
  key: "KF-301",
  link: "https://example.monday.com/boards/1/pulses/301",
  flags: ["active"],
  value: "high",
  effort: "M",
  quadrant: "Q1-do-now",
  due: "2026-03-16",
  details: "Clients/Kestrel Freight/Scanner cut-over.md",
};

export const detailsPage: DetailsPage = {
  path: "Clients/Kestrel Freight/Scanner cut-over.md",
  title: "Scanner cut-over",
  modifiedAt: new Date(STORY_NOW.getTime() - 3 * 3600000).toISOString(),
  md: `---
status: in progress
tracker: KF-301
repos: depot-api, kestrel-freight/scanner-gateway
---
# Scanner cut-over

Move every depot's scanners to the new API before the **Saturday** window. See [[Depot runbook]] and the [vendor notes](https://example.com/notes).

## Plan

1. Freeze the old endpoint
2. Switch the depots in waves
   - North first
   - Then the rest

## Test plan

- [x] Pallet over 1,000 kg scans
- [ ] Offline queue drains after reconnecting

> [!warning] Rollback
> Keep the old endpoint warm until Monday.

| Wave | Depots | When |
| --- | --- | ---: |
| 1 | North | Sat 06:00 |
| 2 | South, East | Sat 09:00 |

\`\`\`sh
gateway switch --wave 1
\`\`\`

> A quote from the depot lead.

---

These stay text: <script>alert("x")</script>, [a script link](javascript:alert(1)) and [an Obsidian link](obsidian://open?vault=x).

![[scanner-wiring.png]]
`,
};
