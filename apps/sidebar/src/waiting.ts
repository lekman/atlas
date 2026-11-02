import type { WaitingItem, WaitingRow } from "@atlas/ui/sidebar";

import { classify, type SidebarConfig } from "./config";

/**
 * The asks this client focus shows, each with its client. A task belongs to
 * its client; a Commander item to the client its worker's name names, and
 * shows under every focus when it names none.
 */
export function waitingRows(
  items: readonly WaitingItem[],
  focus: string,
  config: SidebarConfig,
  clientOf: (key: string) => { name: string; colour: string },
): WaitingRow[] {
  return items.flatMap((item) => {
    const key =
      item.kind === "task"
        ? (item.customer ?? null)
        : classify(item.worker ?? "", null, config);
    if (key && focus !== "all" && key !== focus) return [];
    return [{ item, client: clientOf(key ?? "other") }];
  });
}
