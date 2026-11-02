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

export interface SidebarConfig {
  /** The operator's name, as asks addressed to them begin with it. */
  operator?: string;
  clients: SidebarClient[];
  trackers: SidebarTracker[];
  hostFilters?: Record<string, HostFilter>;
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
