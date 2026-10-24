/**
 * An invented consultancy and four invented clients.
 *
 * Every name here is made up. This repository is public, so stories, tests
 * and screenshots use this dataset and nothing else. Add to it freely; never
 * swap something in from real work. See .claude/rules/client-content.md.
 */
import { Dataset } from "@atlas/core";

import { sampleToday } from "./day-plan";

const own = { classification: "internal", boundary: "home-server" } as const;
const confidential = {
  classification: "client-confidential",
  boundary: "home-server",
} as const;

/**
 * The workstream each item is grouped under. "launch-issuer" is left out on
 * purpose, so the map has unsorted work to draw.
 */
const workstreamOf: Record<string, string> = {
  "send-invoices": "ashgrove-billing",
  "renew-insurance": "ashgrove-cover",
  "cut-over": "halcyon-go-live",
  "weekend-drill": "halcyon-go-live",
  "database-tests": "halcyon-quality",
  "operations-page": "halcyon-portal",
  webhooks: "kestrel-partners",
  "rate-limits": "kestrel-partners",
  "retention-draft": "kestrel-governance",
  "device-kpis": "larchwood-demo",
  "sprint-hours": "larchwood-billing",
  "risk-assessment": "meridian-release",
  "flagged-split": "meridian-release",
  "tls-slice-two": "meridian-harness",
};

/**
 * The day each item not yet started is planned for. The map draws only
 * work in progress or planned for a day, so every item here is on it.
 */
const scheduledFor: Record<string, string> = {
  "renew-insurance": sampleToday,
  "launch-issuer": sampleToday,
  "rate-limits": "2026-10-21",
  "sprint-hours": sampleToday,
  "tls-slice-two": "2026-10-22",
};

export const sampleDataset: Dataset = Dataset.parse({
  clients: [
    { id: "ashgrove", name: "Ashgrove Consulting", home: true, ...own },
    { id: "halcyon", name: "Halcyon Labs", ...confidential },
    { id: "kestrel", name: "Kestrel Freight", ...confidential },
    { id: "larchwood", name: "Larchwood Studio", ...confidential },
    { id: "meridian", name: "Meridian Bank", ...confidential },
  ],
  accounts: [
    { id: "claude-work", label: "Claude · work", runtime: "claude" },
    { id: "claude-personal", label: "Claude · personal", runtime: "claude" },
    { id: "gemini-api", label: "Gemini · API", runtime: "gemini" },
    { id: "n8n-mini", label: "n8n · Mac mini", runtime: "n8n" },
    { id: "launchd", label: "Script · launchd", runtime: "script" },
  ],
  groups: [
    { id: "upkeep", clientId: "ashgrove", name: "Upkeep", ...own },
    {
      id: "go-live",
      clientId: "halcyon",
      name: "Go-live crew",
      ...confidential,
    },
    {
      id: "partner-api",
      clientId: "kestrel",
      name: "Partner API",
      ...confidential,
    },
    { id: "demo", clientId: "larchwood", name: "Demo phase", ...confidential },
    {
      id: "release-split",
      clientId: "meridian",
      name: "Release split",
      ...confidential,
    },
  ],
  agents: [
    agent(
      "invoices",
      "upkeep",
      "Invoices",
      "claude-personal",
      "MacBook",
      "remote-control",
      "running",
      ["send-invoices"],
      "Drafting October invoices",
      own,
    ),
    agent(
      "tracker-sync",
      "upkeep",
      "Tracker sync",
      "launchd",
      "Mac mini",
      "local",
      "running",
      [],
      "Calendar, trackers and GitHub every 15 minutes",
      own,
    ),
    agent(
      "roll-call",
      "upkeep",
      "Roll call",
      "n8n-mini",
      "Mac mini",
      "local",
      "watching",
      [],
      "Asks every agent for status at 07:00",
      own,
    ),

    agent(
      "release",
      "go-live",
      "Release",
      "claude-work",
      "Mac mini",
      "ssh",
      "waiting",
      ["cut-over"],
      "Plan ready; needs your call on alarms",
    ),
    agent(
      "gaps-watch",
      "go-live",
      "Gaps watch",
      "claude-work",
      "Mac mini",
      "remote-control",
      "watching",
      [],
      "Watching the known-gaps queue every 5 minutes",
    ),
    agent(
      "schema",
      "go-live",
      "Schema",
      "claude-work",
      "MacBook",
      "remote-control",
      "running",
      ["cut-over", "database-tests"],
      "Rehearsing the tenant cut-over on staging",
    ),
    agent(
      "test-runner",
      "go-live",
      "Test runner",
      "claude-work",
      "Cloud",
      "none",
      "idle",
      ["database-tests"],
      "Four pull requests open",
    ),
    agent(
      "portal",
      "go-live",
      "Portal",
      "gemini-api",
      "Mac mini",
      "ssh",
      "running",
      ["operations-page"],
      "Building the operations page",
    ),

    agent(
      "tracking",
      "partner-api",
      "Tracking",
      "claude-personal",
      "MacBook",
      "remote-control",
      "running",
      ["webhooks", "rate-limits"],
      "Partner webhooks, then rate limits",
    ),
    agent(
      "policy-writer",
      "partner-api",
      "Policy writer",
      "gemini-api",
      "Cloud",
      "none",
      "idle",
      ["retention-draft"],
      "Retention draft in review",
    ),

    agent(
      "kpi-loader",
      "demo",
      "KPI loader",
      "gemini-api",
      "Cloud",
      "none",
      "idle",
      ["device-kpis"],
      "Waiting for the nightly export",
    ),
    agent(
      "invoice-check",
      "demo",
      "Invoice check",
      "n8n-mini",
      "Mac mini",
      "local",
      "error",
      ["sprint-hours"],
      "Reconcile failed: the sprint export is missing",
    ),

    agent(
      "certificates",
      "release-split",
      "Certificates",
      "claude-work",
      "Mac mini",
      "ssh",
      "blocked",
      ["tls-slice-two"],
      "Slice two waits on the private certificate authority",
    ),
    agent(
      "assessor",
      "release-split",
      "Assessor",
      "claude-work",
      "Mac mini",
      "ssh",
      "running",
      ["risk-assessment"],
      "Risk assessment, second pass",
    ),
    agent(
      "split",
      "release-split",
      "Split",
      "claude-work",
      "MacBook",
      "remote-control",
      "waiting",
      ["flagged-split"],
      "Needs to know which build runs in the pilot",
    ),
  ],
  requirements: [
    {
      id: "vat-filed",
      clientId: "ashgrove",
      title: "Quarterly VAT return filed on time",
      state: "open",
      ...own,
    },

    {
      id: "drill-passes",
      clientId: "halcyon",
      title: "Break-glass drill passes on staging",
      state: "open",
      ...confidential,
    },
    {
      id: "one-tenant",
      clientId: "halcyon",
      title: "Production runs on one tenant",
      state: "open",
      ...confidential,
    },
    {
      id: "listener-ca",
      clientId: "halcyon",
      title: "Listener refuses to start without its certificate",
      state: "done",
      ...confidential,
    },

    {
      id: "shipment-api",
      clientId: "kestrel",
      title: "Shipment API version 2 for partners",
      state: "open",
      ...confidential,
    },
    {
      id: "retention-policy",
      clientId: "kestrel",
      title: "Data retention policy written",
      state: "open",
      ...confidential,
    },

    {
      id: "real-kpis",
      clientId: "larchwood",
      title: "Client demo on real KPIs",
      state: "open",
      ...confidential,
    },

    {
      id: "risk-first",
      clientId: "meridian",
      title: "No release without a risk assessment",
      state: "open",
      ...confidential,
    },
    {
      id: "harness-tls",
      clientId: "meridian",
      title: "TLS inside the test harness",
      state: "open",
      ...confidential,
    },
  ],
  workstreams: [
    workstream("ashgrove-billing", "ashgrove", "Billing", 1, own),
    workstream("ashgrove-cover", "ashgrove", "Cover and compliance", 2, own),
    workstream("halcyon-go-live", "halcyon", "Go-live", 1),
    workstream("halcyon-quality", "halcyon", "Quality", 2),
    workstream("halcyon-portal", "halcyon", "Operations portal", 3),
    workstream("kestrel-partners", "kestrel", "Partner integration", 1),
    workstream("kestrel-governance", "kestrel", "Data governance", 2),
    workstream("larchwood-demo", "larchwood", "Demo data", 1),
    workstream("larchwood-billing", "larchwood", "Billing", 2),
    workstream("meridian-release", "meridian", "Release safety", 1),
    workstream("meridian-harness", "meridian", "Test harness", 2),
  ],
  items: [
    item(
      "send-invoices",
      "ashgrove",
      "Send October invoices",
      "doing",
      "high",
      "vat-filed",
      own,
    ),
    item(
      "renew-insurance",
      "ashgrove",
      "Renew professional insurance",
      "todo",
      "normal",
      undefined,
      own,
    ),

    item(
      "cut-over",
      "halcyon",
      "Rehearse the tenant cut-over",
      "doing",
      "high",
      "one-tenant",
    ),
    item(
      "database-tests",
      "halcyon",
      "Database tests in CI",
      "review",
      "normal",
      "one-tenant",
    ),
    item(
      "weekend-drill",
      "halcyon",
      "Run the drill this weekend",
      "doing",
      "high",
      "drill-passes",
    ),
    item(
      "launch-issuer",
      "halcyon",
      "Launch sends the right issuer",
      "todo",
      "high",
    ),
    item(
      "operations-page",
      "halcyon",
      "Operations status page",
      "doing",
      "normal",
    ),

    item(
      "webhooks",
      "kestrel",
      "Partner webhooks",
      "doing",
      "normal",
      "shipment-api",
    ),
    item(
      "rate-limits",
      "kestrel",
      "Rate limits per partner",
      "todo",
      "normal",
      "shipment-api",
    ),
    item(
      "retention-draft",
      "kestrel",
      "Retention policy draft",
      "review",
      "normal",
      "retention-policy",
    ),

    item(
      "device-kpis",
      "larchwood",
      "Device KPIs into the warehouse",
      "doing",
      "normal",
      "real-kpis",
    ),
    item("sprint-hours", "larchwood", "Reconcile sprint hours", "todo", "high"),

    item(
      "risk-assessment",
      "meridian",
      "Risk assessment draft",
      "review",
      "normal",
      "risk-first",
    ),
    item(
      "flagged-split",
      "meridian",
      "Release split behind a flag",
      "doing",
      "high",
      "risk-first",
    ),
    item(
      "tls-slice-two",
      "meridian",
      "TLS slice two",
      "todo",
      "normal",
      "harness-tls",
    ),
  ],
  questions: [
    question(
      "day-rate",
      "ashgrove",
      "Raise the day rate in January?",
      "send-invoices",
      "You",
      own,
    ),
    question(
      "drill-window",
      "halcyon",
      "When is the 45-minute drill window?",
      "weekend-drill",
      "Release lead",
    ),
    question(
      "alarms-live",
      "halcyon",
      "Severity alarms live at go-live?",
      "cut-over",
      "You",
    ),
    question(
      "scan-retention",
      "kestrel",
      "Keep scans for 7 or 10 years?",
      "retention-draft",
      "You",
    ),
    question(
      "october-hours",
      "larchwood",
      "Which hours fall in October?",
      "sprint-hours",
      "Contractor",
    ),
    question(
      "certificate-authority",
      "meridian",
      "Who issues the private certificate authority?",
      "tls-slice-two",
      "Platform team",
    ),
    question(
      "pilot-build",
      "meridian",
      "Which build runs in the pilot?",
      "flagged-split",
      "You",
    ),
  ],
  decisions: [
    {
      id: "monthly-close",
      clientId: "ashgrove",
      title: "Close the books monthly",
      decides: "vat-filed",
      state: "made",
      ...own,
    },
    {
      id: "single-tenant",
      clientId: "halcyon",
      title: "One tenant in production",
      decides: "one-tenant",
      state: "made",
      ...confidential,
    },
    {
      id: "signed-webhooks",
      clientId: "kestrel",
      title: "Webhooks signed with HMAC",
      decides: "shipment-api",
      state: "made",
      ...confidential,
    },
    {
      id: "not-regulated",
      clientId: "meridian",
      title: "The assistant is not a regulated system",
      decides: "risk-first",
      state: "made",
      ...confidential,
    },
  ],
});

type Governance = {
  classification: "internal" | "client-confidential";
  boundary: string;
};

function agent(
  id: string,
  groupId: string,
  name: string,
  accountId: string,
  host: string,
  reach: string,
  status: string,
  workingOn: string[],
  note: string,
  governance: Governance = confidential,
) {
  return {
    id,
    groupId,
    name,
    accountId,
    host,
    reach,
    status,
    workingOn,
    note,
    ...governance,
  };
}

function item(
  id: string,
  clientId: string,
  title: string,
  state: string,
  priority: string,
  requirementId?: string,
  governance: Governance = confidential,
) {
  return {
    id,
    clientId,
    title,
    state,
    priority,
    ...(requirementId ? { requirementId } : {}),
    ...(workstreamOf[id] ? { workstreamId: workstreamOf[id] } : {}),
    ...(scheduledFor[id] ? { scheduledFor: scheduledFor[id] } : {}),
    ...governance,
  };
}

function workstream(
  id: string,
  clientId: string,
  title: string,
  order: number,
  governance: Governance = confidential,
) {
  return { id, clientId, title, order, ...governance };
}

function question(
  id: string,
  clientId: string,
  title: string,
  blocks: string,
  asks: string,
  governance: Governance = confidential,
) {
  return { id, clientId, title, blocks, asks, state: "open", ...governance };
}
