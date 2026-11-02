import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { ClientPill } from "../ClientPill";
import { hostsTab } from "../hosts/model";
import { HostsPanel } from "../HostsPanel";
import { NextUp } from "../NextUp";
import { Note } from "../Note";
import { Panel } from "../Panel";
import { SidebarFrame } from "../SidebarFrame";
import { SidebarHeader } from "../SidebarHeader";
import { releaseCount } from "../release/model";
import { ReleaseStatus } from "../ReleaseStatus";
import { TabPanel, Tabs } from "../Tabs";
import { WaitingOnYou } from "../WaitingOnYou";
import { visibleViews } from "../views";
import {
  exampleClients,
  exampleTabs,
  exampleViews,
  STORY_NOW,
} from "./examples";
import { clientOfHost, hostsDoc } from "./hosts";
import { releaseDrifted } from "./release";
import { OPERATOR, waitingItems } from "./waiting";

/**
 * The sidebar's frame with every view as an empty panel. The views fill in
 * as each one is built; this page is where they come together.
 */
function SidebarPage({
  initialFocus = "all",
  theme,
}: {
  initialFocus?: string;
  theme: "light" | "dark";
}) {
  const [focus, setFocus] = useState(initialFocus);
  const [view, setView] = useState("worklist");
  const shown = visibleViews(exampleViews, focus, view);
  return (
    <SidebarFrame theme={theme} fill>
      <SidebarHeader
        now={STORY_NOW}
        sync={{ liveAt: STORY_NOW.getTime() - 20000, syncedAt: null }}
      />
      <NextUp
        state="next"
        title="Halcyon Labs weekly with the data team"
        countdown="in 20 min"
        when="10:00–10:45 · Halcyon Labs"
        corner={
          <ClientPill
            clients={exampleClients}
            focus={focus}
            onChoose={setFocus}
          />
        }
      />
      <Tabs
        label="Views"
        idPrefix="page"
        tabs={exampleTabs(shown.views).map((t) =>
          t.id === "hosts"
            ? { ...t, ...hostsTab(hostsDoc.hosts) }
            : t.id === "release"
              ? { ...t, count: releaseCount(releaseDrifted) }
              : t,
        )}
        selected={shown.selected}
        onSelect={setView}
      />
      {shown.views.map((v) => (
        <TabPanel
          key={v.id}
          idPrefix="page"
          id={v.id}
          selected={shown.selected}
        >
          {v.id === "hosts" ? (
            <HostsPanel
              doc={hostsDoc}
              hosts={hostsDoc.hosts}
              live
              allClients={focus === "all"}
              clientOf={clientOfHost}
              now={STORY_NOW}
            />
          ) : v.id === "worklist" ? (
            <Panel
              title={v.label}
              notes={
                <>
                  <WaitingOnYou
                    operator={OPERATOR}
                    rows={waitingItems
                      .filter(
                        (i) =>
                          focus === "all" ||
                          !i.customer ||
                          i.customer === focus,
                      )
                      .map((item) => ({
                        item,
                        client: exampleClients.find(
                          (c) => c.key === item.customer,
                        ) ?? {
                          name: "Other",
                          colour: "var(--client-other)",
                        },
                      }))}
                  />
                  <Note>The worklist joins the sidebar in a later step.</Note>
                </>
              }
            />
          ) : v.id === "release" ? (
            <ReleaseStatus doc={releaseDrifted} live now={STORY_NOW} />
          ) : (
            <>
              {v.id === "kestrel" && focus === "all" && (
                <ReleaseStatus doc={releaseDrifted} live now={STORY_NOW} />
              )}
              <Panel
                title={v.label}
                notes={
                  <Note>This view joins the sidebar in a later step.</Note>
                }
              />
            </>
          )}
        </TabPanel>
      ))}
    </SidebarFrame>
  );
}

const meta = {
  title: "Pages/Sidebar",
  component: SidebarPage,
  parameters: { layout: "fullscreen", viewport: { value: "laptopSidebar" } },
  render: (args, { globals }) => (
    <SidebarPage
      {...args}
      theme={globals.lighting === "night" ? "dark" : "light"}
    />
  ),
} satisfies Meta<typeof SidebarPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every client. Choosing one client in the pill's menu narrows the tabs to
 * that client's.
 */
export const AllClients: Story = {
  name: "All Clients",
  args: { theme: "light" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: /meridian bank/i }));
    await userEvent.click(
      canvas.getByRole("button", { name: /showing all clients/i }),
    );
    await userEvent.click(
      canvas.getByRole("menuitemradio", { name: "Kestrel Freight" }),
    );
    // Meridian's tab went with the focus, so Kestrel's own tab opened.
    await expect(canvas.getByRole("tab", { name: /monday/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(canvas.queryByRole("tab", { name: /github/i })).toBeNull();
  },
};

/** One client chosen, with its release tab. */
export const OneClient: Story = {
  name: "One Client",
  args: { theme: "light", initialFocus: "kestrel" },
};

/** The dark theme, which the accessibility check also runs on. */
export const Dark: Story = {
  args: { theme: "dark" },
  globals: { lighting: "night" },
};

/** The hosts tab open, with one host warning. */
export const Hosts: Story = {
  args: { theme: "light" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: /host alert/i }));
    await expect(canvas.getByRole("region", { name: /hosts/i })).toBeVisible();
  },
};
