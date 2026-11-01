import type { SidebarTabItem, SidebarView } from "@atlas/ui/sidebar";

import type { SidebarConfig } from "./config";

/** The sidebar's views in tab order: shared ones, each client's trackers, hosts last. */
export function sidebarViews(config: SidebarConfig): SidebarView[] {
  const nameOf = (key: string) =>
    config.clients.find((c) => c.key === key)?.name ?? key;
  const views: SidebarView[] = [
    { id: "worklist", labels: ["Worklist", "Worklist"] },
    { id: "agenda", labels: ["Calendar", "Calendar"] },
  ];
  for (const t of config.trackers) {
    views.push({
      id: t.client,
      client: t.client,
      labels: [nameOf(t.client), t.source],
    });
    if (t.release) {
      views.push({
        id: "release",
        client: t.client,
        focusOnly: true,
        labels: ["Release", "Release"],
      });
    }
  }
  views.push({ id: "hosts", labels: ["Host alerts", "Host alerts"] });
  return views;
}

/** How each view's tab looks. Labels are hidden; they are the tooltips. */
export function tabLook(
  config: SidebarConfig,
  id: string,
): Pick<SidebarTabItem, "icon" | "logo" | "end"> {
  if (id === "worklist") return { icon: "list" };
  if (id === "agenda") return { icon: "cal" };
  if (id === "release") return { icon: "branch" };
  if (id === "hosts") return { icon: "pulse", end: true };
  const tracker = config.trackers.find((t) => t.client === id);
  return tracker ? { logo: tracker.logo } : {};
}
