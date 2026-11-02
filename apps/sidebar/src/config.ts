/**
 * What the sidebar knows about the operator's clients and trackers. It is
 * read from `sidebar.config.json` at build time (see `vite.config.ts`), so
 * client names and ids live only in the built file, never in this
 * repository.
 */
export interface SidebarClient {
  /** The key the task database and the stored copies use. */
  key: string;
  name: string;
  /** The theme's colour slot, `--client-<slot>`, 1 to 5. */
  slot: number;
  /**
   * Words that name this client in a Commander worker's name or an event's
   * title, matched as whole words, ignoring case.
   */
  keywords?: string[];
  /** The client's GitHub organisation, for bare repository names on a details page. */
  githubOrg?: string;
}

/** The Monday board a tracker reads, and how its columns are used. */
export interface MondayBoard {
  boardId: number;
  /** The people column, and the operator's person id in it. */
  personColumn: string;
  personId: string;
  columns: { status: string; priority?: string; key?: string };
  /** The status column's index for Done, which the query leaves out. */
  doneIndex?: number;
  /** Item numbers show as `<prefix>-<number>`. */
  keyPrefix: string;
}

/** A client's tracker tab: its name with every client shown is the client's. */
export interface SidebarTracker {
  client: string;
  /** The tab's name with one client chosen: "Jira", "Monday", "GitHub". */
  source: string;
  logo: "monday" | "jira" | "github";
  /** The panel's title after the client's name, as "Tech board, mine". */
  title?: string;
  /** A release-status tab, shown only with this client chosen. */
  release?: boolean;
  monday?: MondayBoard;
  /** The GitHub repository whose open issues the tab lists. */
  github?: { owner: string; name: string };
}

/**
 * Which hosts a client focus shows. A host shows when its client is listed
 * in `clients`, its client is not in `notClients` (when that is given), or
 * its name is in `hosts` (a trailing `*` matches a prefix). A focus without
 * a filter shows the client's own hosts.
 */
export interface HostFilter {
  clients?: string[];
  notClients?: string[];
  hosts?: string[];
}

/** A calendar read through a connector: whose it is, and its name in the sidebar. */
export interface ConnectedCalendar {
  /** The client its events belong to when the title names none. */
  client: string;
  /** Shown under each event and before its errors, as "Work calendar". */
  label: string;
}

export interface CalendarConfig {
  /** Where wall-clock times without a known zone are read, an IANA name. */
  timeZone: string;
  google?: ConnectedCalendar;
  outlook?: ConnectedCalendar;
  /** Clients whose feed carries other clients' work, read by title. */
  mixedFeeds?: string[];
  /** Placeholder meetings for a client without a calendar, and the note that says so. */
  samples?: { client: string; note: string };
}

/**
 * The phone inbox: a D1 database, written through the Cloudflare
 * connector, where a view without the local server leaves its requests
 * for the bridge on the Mac mini to forward.
 */
export interface InboxConfig {
  /** The connector's server name and query tool, as the runtime names them. */
  server: string;
  tool: string;
  databaseId: string;
}

export interface SidebarConfig {
  /** The operator's name, as asks addressed to them begin with it. */
  operator?: string;
  clients: SidebarClient[];
  trackers: SidebarTracker[];
  hostFilters?: Record<string, HostFilter>;
  calendar?: CalendarConfig;
  inbox?: InboxConfig;
}

declare const __SIDEBAR_CONFIG__: SidebarConfig;

export const config: SidebarConfig = __SIDEBAR_CONFIG__;

/** The CSS colour for a client, or the colour for clients without a slot. */
export function clientColour(
  key: string,
  from: SidebarConfig = config,
): string {
  const slot = from.clients.find((c) => c.key === key)?.slot;
  return slot && slot >= 1 && slot <= 5
    ? `var(--client-${slot})`
    : "var(--client-other)";
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The client a piece of text names, by the clients' keywords in config
 * order, or the fallback.
 */
export function classify(
  text: string,
  fallback: string | null,
  from: SidebarConfig = config,
): string | null {
  for (const client of from.clients) {
    const words = client.keywords ?? [];
    if (!words.length) continue;
    const pattern = new RegExp(`\\b(${words.map(escape).join("|")})\\b`, "i");
    if (pattern.test(text)) return client.key;
  }
  return fallback;
}
