/**
 * Invented item log entries for a few items in the sample dataset, as the
 * task database's `item_log` holds them, newest first. They never join the
 * dataset: a view reads them for the selected item through a loader, and
 * stories pass `sampleItemLogLoader`.
 *
 * `sampleRecordedEvents` is the scripted day as the server's event log
 * would hold it on the morning of the sample day, so a story's log is
 * full from the start. The item log entries fall between those events.
 */
import type { AtlasEvent, ItemLogEntry } from "@atlas/core";

import { sampleScript } from "./script";

export const sampleItemLogs: Readonly<Record<string, readonly ItemLogEntry[]>> =
  {
    webhooks: [
      {
        at: "2026-10-24T10:31:00.000Z",
        status: "review",
        note: "Signed webhooks ready for review in pull request 418",
        by: "tracking",
      },
      {
        at: "2026-10-24T10:14:00.000Z",
        status: "doing",
        note: "Fixed the retry header; the contract suite runs again",
        by: "tracking",
      },
      {
        at: "2026-10-24T09:51:00.000Z",
        status: "blocked",
        note: "Contract test 7 rejects the retry header; asked for a call",
        by: "tracking",
      },
      {
        at: "2026-10-24T08:52:00.000Z",
        status: "doing",
        note: "Signature header added; contract tests next",
        by: "tracking",
      },
      {
        at: "2026-10-24T08:15:00.000Z",
        status: "doing",
        note: "Claimed. Starting with the signing key rotation",
        by: "Tracking",
      },
      {
        at: "2026-10-23T16:40:00.000Z",
        status: "todo",
        note: "Partner asked for signed webhooks before the November cut-over",
      },
    ],
    "database-tests": [
      {
        at: "2026-10-24T09:20:00.000Z",
        status: "doing",
        note: "Running the database tests against the staging copy",
        by: "test-runner",
      },
      {
        at: "2026-10-24T08:05:00.000Z",
        status: "review",
        note: "Four pull requests open for the flaky fixtures",
        by: "schema",
      },
    ],
    "retention-draft": [
      {
        at: "2026-10-24T09:06:00.000Z",
        status: "review",
        note: "Draft sent for review; a launch checks it against shipments",
        by: "policy-writer",
      },
    ],
  };

/** Reads the invented item log for one item, as a view's loader would. */
export async function sampleItemLogLoader(
  itemId: string,
): Promise<readonly ItemLogEntry[]> {
  return sampleItemLogs[itemId] ?? [];
}

/**
 * Noon on the sample day, the moment a story's log counts its last 24
 * hours back from. Every recorded event and item log entry falls inside.
 */
export const sampleLogNow = new Date("2026-10-24T12:00:00.000Z");

/** The minutes between the scripted day's events in the recorded log. */
const minutesApart = 4;

/** The scripted day as the server's log holds it, from 09:00 on the sample day. */
export const sampleRecordedEvents: readonly {
  sequence: number;
  receivedAt: string;
  event: AtlasEvent;
}[] = sampleScript
  .filter((step): step is AtlasEvent => step.type !== "reset")
  .map((event, index) => ({
    sequence: index + 1,
    receivedAt: new Date(
      Date.UTC(2026, 9, 24, 9, index * minutesApart),
    ).toISOString(),
    event,
  }));
