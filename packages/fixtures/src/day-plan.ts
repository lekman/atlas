/**
 * An invented day plan for the invented clients in `dataset.ts`: tasks in
 * every band, their notes and meetings, two details documents and the dry
 * run of an import.
 *
 * Every task, key, address, note and person here is made up. Addresses use
 * the reserved `.example` domain so none of them can lead anywhere. See
 * .claude/rules/client-content.md.
 */
import { DayPlan, ImportReport, type BacklogItem } from "@atlas/core";

const own = { classification: "internal", boundary: "home-server" } as const;
const confidential = {
  classification: "client-confidential",
  boundary: "home-server",
} as const;

/** The plan's today: a Monday. */
export const sampleToday = "2026-10-19";
const tomorrow = "2026-10-20";

type Fields = Omit<
  BacklogItem,
  | "id"
  | "clientId"
  | "title"
  | "classification"
  | "boundary"
  | "state"
  | "priority"
> &
  Partial<Pick<BacklogItem, "state" | "priority">>;

function task(id: string, clientId: string, title: string, fields: Fields) {
  return {
    id,
    clientId,
    title,
    state: "todo",
    priority: "normal",
    ...(clientId === "ashgrove" ? own : confidential),
    ...fields,
  };
}

function jira(key: string) {
  const project = key.split("-")[0]?.toLowerCase() ?? "work";
  return {
    system: "jira" as const,
    key,
    url: `https://${project}.tracker.example/browse/${key}`,
  };
}

const cutOverRunbook = `---
tags: [halcyon, cut-over]
---
# Tenant cut-over rehearsal

The rehearsal moves **one tenant** from the shared database to its own, on
staging, end to end. It proves the runbook before the real cut-over on
*Saturday 24 October*. See [[Cut-over runbook]] for the steps themselves and
[[Halcyon Labs brief|the client brief]] for why the split matters.

> [!warning] Staging is frozen until 16:00
> Nobody merges to the staging branch during the rehearsal. The Schema agent
> holds the lock and releases it in the review at 14:00.

## Who does what

| Step                       | Owner       | Time  |
| :------------------------- | :---------- | ----: |
| Snapshot the shared tenant | Schema      | 09:50 |
| Restore into the new store | Schema      | 10:20 |
| Switch the tenant's route  | Release     | 11:00 |
| Run the smoke tests        | Test runner | 11:15 |
| Sign off or roll back      | You         | 14:00 |

## Before the switch

1. Confirm the snapshot's row counts match the source.
2. Check the alarms point at the new store:
   - error rate on the tenant route
   - replication lag above 30 seconds
3. Post in the rehearsal channel that the switch is next.

The route switch is one command, kept in the runbook so nobody types it from
memory:

\`\`\`sh
atlas-demo route set --tenant tenant-07 --store tenant-07-primary --dry-run
\`\`\`

## Rolling back

If the smoke tests fail, the route goes back to the shared store and the new
store is kept for inspection, not deleted. A rollback is a result, not a
failure: write down what broke in [[Rehearsal log]].

> Raw HTML in a note stays as text: <b>not bold</b>, and
> <script>alert("never runs")</script> is shown, never run.

- [x] Runbook reviewed with the Release agent
- [ ] Rollback timed under ten minutes
- [ ] Decision recorded for Saturday

![[cut-over-diagram.png]]
`;

const webhookRetries = `# Partner webhook retries

Partners lose events when their endpoint is down for longer than a minute.
The fix is a retry queue with **exponential back-off**, capped at six hours.

- Retries at 1, 5, 30 and 120 minutes, then every six hours
- After 24 hours, the event goes to the dead-letter list
- Partners can replay from the list themselves

> [!note] Open question
> Does Kestrel Freight want a webhook for each retry, or only the last one?

Tracked as [KST-88](https://kst.tracker.example/browse/KST-88).
`;

export const sampleDayPlan: DayPlan = DayPlan.parse({
  today: sampleToday,
  items: [
    // Ashgrove Consulting, home.
    task("invoices-out", "ashgrove", "Send October invoices", {
      summary: "Five invoices, two with expenses attached. Due by the 20th.",
      tracker: {
        system: "github",
        key: "#41",
        url: "https://github.example/ashgrove/books/issues/41",
      },
      effort: "S",
      value: 8,
      scheduledFor: sampleToday,
      history: [{ kind: "added", on: "2026-10-15" }],
    }),
    task("chase-payment", "ashgrove", "Chase the overdue transfer", {
      summary: "September's invoice to Meridian Bank is twelve days late.",
      effort: "XS",
      value: 5,
      scheduledFor: "2026-10-16",
      history: [
        { kind: "added", on: "2026-10-14" },
        { kind: "moved", on: "2026-10-15", from: "2026-10-15" },
      ],
    }),
    task("renew-insurance-day", "ashgrove", "Renew professional insurance", {
      summary: "Two quotes in; compare the excess before choosing.",
      scheduledFor: sampleToday,
      priority: "high",
    }),
    task("expenses-folder", "ashgrove", "Tidy the expenses folder", {
      effort: "M",
      value: 1,
      scheduledFor: tomorrow,
    }),
    task("newsletter", "ashgrove", "Write the quarterly newsletter", {
      priority: "low",
    }),

    // Halcyon Labs.
    task("rehearse-cut-over", "halcyon", "Rehearse the tenant cut-over", {
      summary: "One tenant, end to end on staging, before Saturday's switch.",
      tracker: jira("HAL-142"),
      effort: "L",
      value: 13,
      scheduledFor: sampleToday,
      detailsId: "cut-over-rehearsal",
      state: "doing",
      history: [
        { kind: "added", on: "2026-10-12" },
        { kind: "moved", on: "2026-10-16", from: "2026-10-16" },
      ],
    }),
    task("alarm-routing", "halcyon", "Confirm alarm routing", {
      summary: "Operations have not said which rota gets the new alarms.",
      tracker: jira("HAL-150"),
      effort: "S",
      value: 5,
      scheduledFor: sampleToday,
      blocked: true,
    }),
    task("flaky-login", "halcyon", "Fix the flaky sign-in test", {
      tracker: jira("HAL-139"),
      effort: "S",
      value: 2,
      scheduledFor: sampleToday,
      state: "done",
      doneOn: sampleToday,
    }),
    task("rewrite-reports", "halcyon", "Rewrite reporting in a new framework", {
      summary: "Nice to have; the current reports work.",
      tracker: jira("HAL-155"),
      effort: "XL",
      value: 2,
      scheduledFor: sampleToday,
    }),

    // Kestrel Freight.
    task("retention-wording", "kestrel", "Draft the retention policy", {
      summary: "Imported with its red marker; needs a size.",
      tracker: jira("KST-91"),
      scheduledFor: sampleToday,
      priority: "high",
    }),
    task("webhook-retries", "kestrel", "Partner webhook retries", {
      summary: "A retry queue with back-off, so partners stop losing events.",
      tracker: jira("KST-88"),
      effort: "M",
      value: 8,
      scheduledFor: tomorrow,
      detailsId: "webhook-retries",
    }),

    // Larchwood Studio.
    task("demo-script", "larchwood", "Prepare the demo script", {
      summary: "Walk-through for Wednesday: three journeys, ten minutes each.",
      tracker: {
        system: "monday",
        key: "LRW-31",
        url: "https://larchwood.board.example/items/31",
      },
      effort: "M",
      value: 5,
      scheduledFor: sampleToday,
    }),
    task(
      "pilot-feedback",
      "larchwood",
      "Collect feedback from pilot users",
      {},
    ),

    // Meridian Bank.
    task("audit-logging", "meridian", "Close the logging audit finding", {
      tracker: jira("MER-198"),
      effort: "M",
      value: 3,
      scheduledFor: sampleToday,
      state: "done",
      doneOn: sampleToday,
    }),
    task("access-matrix", "meridian", "Review the access matrix", {
      tracker: jira("MER-210"),
      effort: "XS",
      value: 1,
      scheduledFor: tomorrow,
    }),
    task("release-train", "meridian", "Split the release train", {
      summary: "Two trains, one for the mobile app and one for the web.",
      tracker: jira("MER-207"),
      effort: "XL",
      value: 8,
      scheduledFor: "2026-10-28",
    }),
  ],
  notes: [
    {
      clientId: "ashgrove",
      on: sampleToday,
      kind: "intention",
      text: "Invoices out before lunch, then clear the admin pile.",
      watch: "The September transfer from Meridian Bank.",
    },
    {
      clientId: "halcyon",
      on: sampleToday,
      kind: "overview",
      text: "Rehearsal day for the tenant cut-over. Staging is frozen until 16:00.",
      watch: "Alarm routing is still unconfirmed.",
    },
    {
      clientId: "kestrel",
      on: sampleToday,
      kind: "overview",
      text: "Partner API in review; the retention policy waits for wording.",
    },
    {
      clientId: "larchwood",
      on: sampleToday,
      kind: "intention",
      text: "Demo script ready for Wednesday.",
    },
    {
      clientId: "kestrel",
      on: tomorrow,
      kind: "intention",
      text: "Retries designed and agreed with the partner team.",
    },
  ],
  calendar: [
    {
      clientId: "halcyon",
      on: sampleToday,
      start: "09:15",
      end: "09:45",
      title: "Cut-over stand-up",
    },
    {
      clientId: "halcyon",
      on: sampleToday,
      start: "14:00",
      end: "15:00",
      title: "Rehearsal review",
    },
    {
      clientId: "larchwood",
      on: sampleToday,
      start: "11:00",
      end: "11:30",
      title: "Demo walk-through",
    },
    {
      clientId: "ashgrove",
      on: sampleToday,
      start: "16:30",
      end: "17:00",
      title: "Accountant call",
    },
    {
      clientId: "kestrel",
      on: tomorrow,
      start: "10:00",
      end: "10:30",
      title: "Partner sync",
    },
  ],
  documents: [
    {
      id: "cut-over-rehearsal",
      clientId: "halcyon",
      title: "Tenant cut-over rehearsal",
      markdown: cutOverRunbook,
      sourcePath: "Clients/Halcyon Labs/Cut-over rehearsal.md",
      updatedOn: "2026-10-18",
      ...confidential,
    },
    {
      id: "webhook-retries",
      clientId: "kestrel",
      title: "Partner webhook retries",
      markdown: webhookRetries,
      sourcePath: "Clients/Kestrel Freight/Webhook retries.md",
      updatedOn: "2026-10-12",
      ...confidential,
    },
  ],
});

/** The dry run of importing an invented dashboard, before anything is written. */
export const sampleImportReport: ImportReport = ImportReport.parse({
  sourcePath: "Planner/Dashboard.md",
  readOn: sampleToday,
  counts: [
    { clientId: "ashgrove", band: "today", tasks: 3 },
    { clientId: "ashgrove", band: "tomorrow", tasks: 1 },
    { clientId: "ashgrove", band: "unscheduled", tasks: 4 },
    { clientId: "halcyon", band: "today", tasks: 4 },
    { clientId: "halcyon", band: "future", tasks: 6 },
    { clientId: "kestrel", band: "today", tasks: 1 },
    { clientId: "kestrel", band: "tomorrow", tasks: 2 },
    { clientId: "larchwood", band: "today", tasks: 1 },
    { clientId: "larchwood", band: "unscheduled", tasks: 2 },
    { clientId: "meridian", band: "today", tasks: 1 },
    { clientId: "meridian", band: "tomorrow", tasks: 1 },
    { clientId: "meridian", band: "future", tasks: 3 },
  ],
  unplaced: [
    {
      line: 37,
      reason: "A task with no client heading above it",
      excerpt: "- [ ] **Share the folder.** Ask who needs access",
    },
    {
      line: 112,
      reason: "A day heading that is not a date",
      excerpt: "## Someday",
    },
    {
      line: 140,
      reason:
        "Two tracker links; the importer does not guess which is the task",
      excerpt: "- [ ] **Align keys.** [HAL-160](…) [KST-95](…)",
    },
  ],
  heldBack: [58, 203],
  waitingForSize: [
    { clientId: "ashgrove", title: "Renew professional insurance" },
    { clientId: "ashgrove", title: "Write the quarterly newsletter" },
    { clientId: "kestrel", title: "Draft the retention policy" },
    { clientId: "larchwood", title: "Collect feedback from pilot users" },
  ],
});
