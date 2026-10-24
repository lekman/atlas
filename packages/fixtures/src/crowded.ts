/**
 * The busy dataset with a second client grown crowded: Kestrel Freight
 * carries eight workstreams and unsorted work, each with more items on the
 * map than a workstream draws, and titles as long as real ones get (80 to
 * 150 characters). Two workstream titles are longer than a caption shows.
 * Stories and tests use it to prove the orbit stays readable at that
 * scale and that long titles are shortened on the map.
 *
 * Every title is invented and generic. See .claude/rules/client-content.md.
 */
import { Dataset, type BacklogItem, type Workstream } from "@atlas/core";

import { busyDataset } from "./busy";
import { sampleToday } from "./day-plan";

/** The client that is crowded. */
export const crowdedClientId = "kestrel";

const confidential = {
  classification: "client-confidential",
  boundary: "home-server",
} as const;

/** The six workstreams added to the two Kestrel Freight already has. */
const addedWorkstreams: Workstream[] = [
  ["kestrel-customs", "Customs paperwork and border declarations"],
  ["kestrel-warehouse", "Warehouse scanning"],
  ["kestrel-drivers", "Driver app"],
  ["kestrel-billing", "Billing and invoicing for partner carriers"],
  ["kestrel-routes", "Route planning"],
  ["kestrel-fleet", "Fleet maintenance"],
].map(([id, title], index) => ({
  id: id!,
  clientId: crowdedClientId,
  title: title!,
  order: index + 3,
  ...confidential,
}));

/** The first halves of item titles: what is done, to what. */
const tasks = [
  "Agree the cut-off times for the overnight trailers with the depot leads",
  "Write the step-by-step guide for checking a pallet in at the dock door",
  "Move the nightly reconciliation job onto the new scheduler",
  "Draft the message partners receive when a delivery window changes",
  "Replace the hand-written exceptions list with a shared tracker",
  "Test the fallback path when the label printer service is down",
  "Collect the signed declarations from every carrier on the list",
];

/** The second halves: why, or what it waits on. */
const reasons = [
  "so the morning shift stops waiting on missing paperwork",
  "before the seasonal peak starts in the second week of next month",
  "and record what changed for the quarterly review with the operations team",
  "once the partner sandbox accepts version two of the shipment interface",
  "so nobody has to re-key the same reference numbers twice a day",
];

/** Which workstream each crowded item belongs to; undefined is unsorted. */
const groups: Array<string | undefined> = [
  "kestrel-partners",
  "kestrel-governance",
  ...addedWorkstreams.map((workstream) => workstream.id),
  undefined,
];

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Six or seven items per group, all on the map, with long titles. */
function crowdedItems(): BacklogItem[] {
  const items: BacklogItem[] = [];
  groups.forEach((workstreamId, group) => {
    const count = group % 2 === 0 ? 7 : 6;
    for (let index = 0; index < count; index++) {
      const number = items.length + 1;
      const task = tasks[(group + index) % tasks.length]!;
      const reason = reasons[(group * 2 + index) % reasons.length]!;
      items.push({
        id: `kestrel-crowded-${String(number).padStart(3, "0")}`,
        clientId: crowdedClientId,
        ...(workstreamId ? { workstreamId } : {}),
        title: `${task} ${reason}`,
        state: index % 3 === 0 ? "doing" : "todo",
        priority: index === 0 ? "high" : index < 4 ? "normal" : "low",
        scheduledFor: addDays(sampleToday, index - 1),
        ...confidential,
      });
    }
  });
  return items;
}

/**
 * The busy dataset, with Kestrel Freight crowded: eight workstreams and
 * unsorted work, six or seven long-titled items on the map in each.
 */
export const crowdedDataset: Dataset = Dataset.parse({
  ...busyDataset,
  workstreams: [...busyDataset.workstreams, ...addedWorkstreams],
  items: [...busyDataset.items, ...crowdedItems()],
});
