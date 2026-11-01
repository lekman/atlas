/**
 * Invented data for the sidebar stories. This Storybook is public, so the
 * clients are the fixtures' invented consultancy and its four clients.
 */
import type { ClientChoice } from "../ClientPill";
import type { SidebarTabItem } from "../Tabs";
import type { SidebarView } from "../views";

/** A Thursday morning, so every story renders the same date and times. */
export const STORY_NOW = new Date("2026-03-12T09:40:00");

export const exampleClients: ClientChoice[] = [
  { key: "halcyon", name: "Halcyon Labs", colour: "var(--client-1)" },
  { key: "kestrel", name: "Kestrel Freight", colour: "var(--client-2)" },
  { key: "larchwood", name: "Larchwood Studio", colour: "var(--client-3)" },
  { key: "meridian", name: "Meridian Bank", colour: "var(--client-4)" },
  { key: "ashgrove", name: "Ashgrove Consulting", colour: "var(--client-5)" },
];

/** The sidebar's views, with three clients that have a tracker of their own. */
export const exampleViews: SidebarView[] = [
  { id: "worklist", labels: ["Worklist", "Worklist"] },
  { id: "agenda", labels: ["Calendar", "Calendar"] },
  { id: "kestrel", client: "kestrel", labels: ["Kestrel Freight", "Monday"] },
  {
    id: "release",
    client: "kestrel",
    focusOnly: true,
    labels: ["Release", "Release"],
  },
  { id: "halcyon", client: "halcyon", labels: ["Halcyon Labs", "Jira"] },
  { id: "meridian", client: "meridian", labels: ["Meridian Bank", "GitHub"] },
  { id: "hosts", labels: ["Host alerts", "Host alerts"] },
];

const LOOK: Record<string, Pick<SidebarTabItem, "icon" | "logo">> = {
  worklist: { icon: "list" },
  agenda: { icon: "cal" },
  kestrel: { logo: "monday" },
  release: { icon: "branch" },
  halcyon: { logo: "jira" },
  meridian: { logo: "github" },
  hosts: { icon: "pulse" },
};

const COUNTS: Record<string, string> = {
  worklist: "7",
  agenda: "4",
  kestrel: "12",
  release: "2",
  halcyon: "5",
  meridian: "9",
};

/** Views as tabs, icon only, with counts; host alerts at the far end. */
export function exampleTabs(
  views: ReadonlyArray<SidebarView & { label: string }>,
  hosts: SidebarTabItem["tone"] = undefined,
): SidebarTabItem[] {
  return views.map((v) => ({
    id: v.id,
    label: v.label,
    ...LOOK[v.id],
    count: v.id === "hosts" ? (hosts ? "1" : undefined) : COUNTS[v.id],
    tone: v.id === "hosts" ? hosts : undefined,
    end: v.id === "hosts",
    iconOnly: true,
  }));
}
