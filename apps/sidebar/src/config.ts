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
}

export interface SidebarConfig {
  clients: SidebarClient[];
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
