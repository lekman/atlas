/**
 * A scripted day: the events the sample dataset goes through, in order.
 * Stories replay it to show motion; tests replay it to prove every event
 * names something that exists. Early on, Tracking launches two vessels, one
 * to the retention draft and one to the rate limits, and the second
 * returns a few steps later. `reset` returns to the start, so a loop can
 * run for as long as a story stays open.
 */
import type { AtlasEvent } from "@atlas/core";

export type ScriptStep = AtlasEvent | { type: "reset" };

const confidential = {
  classification: "client-confidential",
  boundary: "home-server",
} as const;

export const sampleScript: ScriptStep[] = [
  {
    type: "agent-message",
    from: "schema",
    to: "gaps-watch",
    text: "Hold staging releases while I rehearse",
  },
  {
    type: "agent-launched",
    agentId: "retention-check",
    parentId: "tracking",
    name: "Retention check",
    workingOn: ["retention-draft"],
    text: "Checking the draft against the shipment records",
  },
  {
    type: "external",
    source: "github",
    recordId: "database-tests",
    text: "Pull request 366: checks passed",
  },
  {
    type: "agent-launched",
    agentId: "limit-survey",
    parentId: "tracking",
    name: "Limit survey",
    workingOn: ["rate-limits"],
    text: "Measuring each partner's peak request rate",
  },
  {
    type: "status-change",
    agentId: "test-runner",
    to: "running",
    text: "Picked up the CI database tests",
  },
  {
    type: "agent-message",
    from: "assessor",
    to: "split",
    text: "The risk assessment covers the flag work",
  },
  {
    type: "external",
    source: "calendar",
    recordId: "weekend-drill",
    text: "Drill window booked, Saturday 10:00",
  },
  {
    type: "agent-returned",
    agentId: "limit-survey",
    text: "Peak rates noted on the task; the busiest partner needs 40 a second",
  },
  {
    type: "question-answered",
    questionId: "drill-window",
    answer: "Saturday, 10:00 to 10:45",
    decision: {
      id: "drill-saturday",
      clientId: "halcyon",
      title: "Drill on Saturday at 10:00",
      decides: "weekend-drill",
      state: "made",
      ...confidential,
    },
  },
  {
    type: "agent-message",
    from: "roll-call",
    to: "tracking",
    text: "Roll call: where do you stand?",
  },
  {
    type: "agent-message",
    from: "tracking",
    to: "roll-call",
    text: "Webhooks four fifths done",
  },
  {
    type: "external",
    source: "ci",
    recordId: "webhooks",
    text: "Build 412 failed a contract test",
  },
  {
    type: "status-change",
    agentId: "tracking",
    to: "waiting",
    text: "Needs your call on the failing contract test",
  },
  {
    type: "external",
    source: "jira",
    recordId: "tls-slice-two",
    text: "Ticket moved to Blocked",
  },
  {
    type: "status-change",
    agentId: "kpi-loader",
    to: "running",
    text: "Started the warehouse load",
  },
  {
    type: "agent-message",
    from: "tracker-sync",
    to: "roll-call",
    text: "Calendar and trackers synced",
  },
  {
    type: "external",
    source: "mail",
    recordId: "send-invoices",
    text: "Accountant confirmed the VAT figures",
  },
  {
    type: "agent-message",
    from: "portal",
    to: "release",
    text: "The operations page shows the cut-over status",
  },
  {
    type: "status-change",
    agentId: "tracking",
    to: "running",
    text: "Retrying with the fixed contract",
  },
  {
    type: "status-change",
    agentId: "test-runner",
    to: "idle",
    text: "Finished; all green",
  },
  {
    type: "external",
    source: "mail",
    recordId: "sprint-hours",
    text: "Contractor sent the October timesheet",
  },
  {
    type: "status-change",
    agentId: "invoice-check",
    to: "running",
    text: "Re-running the reconcile",
  },
  {
    type: "status-change",
    agentId: "kpi-loader",
    to: "idle",
    text: "Warehouse load complete",
  },
  {
    type: "status-change",
    agentId: "invoice-check",
    to: "error",
    text: "The export is still missing two days",
  },
  { type: "reset" },
];
