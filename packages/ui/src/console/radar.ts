import type { GitHubPage } from "../sidebar/trackers/github";
import type { JiraDoc } from "../sidebar/trackers/jira";
import type { MondayPage } from "../sidebar/trackers/monday";
import type { WorkItem } from "../sidebar/worklist/model";

export type RadarView = "tickets" | "meetings";

export type RadarSystem = "jira" | "monday" | "github";

/** One tracker ticket on the radar, and the task it already is, if any. */
export interface RadarTicket {
  system: RadarSystem;
  /** The client key it belongs to. */
  client: string;
  key: string;
  title: string;
  url: string | null;
  status: string | null;
  priority: string | null;
  /** When the tracker last changed it, ISO 8601. */
  updated: string | null;
  /** The worklist task with the same key, when the ticket is already work. */
  task: WorkItem | null;
}

export interface RadarInput {
  jira?: { client: string; doc: JiraDoc | null | undefined } | null;
  monday?: { client: string; page: MondayPage | null } | null;
  github?: {
    client: string;
    page: GitHubPage | null;
    /** The operator's login: only issues assigned to them show, when it is known. */
    me: string | null;
  } | null;
  /** The worklist, to tell tickets that are already tasks. */
  items: readonly WorkItem[];
}

/**
 * Every ticket assigned to the operator across the trackers: Jira's synced
 * issues, the monday.com board's items not done, and the GitHub issues
 * assigned to the operator. Each says whether it is already a task.
 * Newest change first within each client.
 */
export function radarTickets(input: RadarInput): RadarTicket[] {
  const taskFor = (key: string) =>
    input.items.find((t) => t.key === key && !t.meeting) ?? null;
  const out: RadarTicket[] = [];
  const jira = input.jira;
  if (jira?.doc?.ok)
    for (const i of jira.doc.items)
      out.push({
        system: "jira",
        client: jira.client,
        key: i.key,
        title: i.summary ?? i.key,
        url: i.url ?? null,
        status: i.status ?? null,
        priority: i.priority ?? null,
        updated: i.updated ?? null,
        task: taskFor(i.key),
      });
  const monday = input.monday;
  if (monday?.page)
    for (const i of monday.page.items) {
      if (!i.key) continue;
      out.push({
        system: "monday",
        client: monday.client,
        key: i.key,
        title: i.name,
        url: i.url,
        status: i.status || null,
        priority: i.priority,
        updated: i.updated.toISOString(),
        task: taskFor(i.key),
      });
    }
  const github = input.github;
  if (github?.page)
    for (const i of github.page.items) {
      if (github.me && !i.assignees.includes(github.me)) continue;
      const key = `#${i.number}`;
      out.push({
        system: "github",
        client: github.client,
        key,
        title: i.title,
        url: i.url,
        status: i.labels[0] ?? null,
        priority: null,
        updated: i.updated,
        task: taskFor(key),
      });
    }
  return out.sort(
    (a, b) =>
      a.client.localeCompare(b.client) ||
      String(b.updated ?? "").localeCompare(String(a.updated ?? "")),
  );
}

/** Tickets grouped by client, in the order the config lists the clients. */
export function ticketGroups(
  tickets: readonly RadarTicket[],
  clientOrder: readonly string[],
): Array<{ client: string; tickets: RadarTicket[] }> {
  const groups = new Map<string, RadarTicket[]>();
  for (const t of tickets) {
    const list = groups.get(t.client) ?? [];
    list.push(t);
    groups.set(t.client, list);
  }
  const rank = (c: string) => {
    const i = clientOrder.indexOf(c);
    return i < 0 ? clientOrder.length : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([client, list]) => ({ client, tickets: list }));
}
