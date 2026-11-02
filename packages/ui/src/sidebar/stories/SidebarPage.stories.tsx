import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Agenda } from "../Agenda";
import { agendaDays } from "../calendar/model";
import { ClientPill } from "../ClientPill";
import { DetailsView } from "../DetailsView";
import { pullCounts } from "../details/pulls";
import { PullRequests } from "../PullRequests";
import { hostsTab } from "../hosts/model";
import { GitHubList } from "../GitHubList";
import { HostsPanel } from "../HostsPanel";
import { JiraList } from "../JiraList";
import { MondayList } from "../MondayList";
import { NextUp } from "../NextUp";
import { Note } from "../Note";
import { Panel } from "../Panel";
import { SidebarFrame } from "../SidebarFrame";
import { SidebarHeader } from "../SidebarHeader";
import { releaseCount } from "../release/model";
import { ReleaseStatus } from "../ReleaseStatus";
import { TabPanel, Tabs } from "../Tabs";
import { WaitingOnYou } from "../WaitingOnYou";
import type { Band, WorkItem } from "../worklist/model";
import { Worklist } from "../WorklistPanel";
import { visibleViews } from "../views";
import {
  exampleClients,
  exampleTabs,
  exampleViews,
  STORY_NOW,
} from "./examples";
import { clientOfHost, hostsDoc } from "./hosts";
import { weekEvents } from "./calendar";
import { detailsPage } from "./details";
import { pullsDoc } from "./pulls";
import { githubExample } from "./github";
import { jiraExample } from "./jira";
import { mondayExample } from "./monday";
import { releaseDrifted } from "./release";
import { OPERATOR, waitingItems } from "./waiting";
import { STORY_TODAY, STORY_TOMORROW, worklistItems } from "./worklist";

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
  const [band, setBand] = useState<Band>("today");
  const [opened, setOpened] = useState<WorkItem | null>(null);
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
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
            <Worklist
              items={worklistItems}
              band={band}
              onBand={setBand}
              clients={exampleClients}
              focus={focus}
              folded={folded}
              onFold={(key) => {
                const next = new Set(folded);
                if (!next.delete(key)) next.add(key);
                setFolded(next);
              }}
              showDone={false}
              showWaiting
              today={STORY_TODAY}
              tomorrow={STORY_TOMORROW}
              onOpen={(item) => setOpened(item)}
              notes={
                <WaitingOnYou
                  operator={OPERATOR}
                  rows={waitingItems
                    .filter(
                      (i) =>
                        focus === "all" || !i.customer || i.customer === focus,
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
              }
            />
          ) : v.id === "agenda" ? (
            <Agenda
              days={agendaDays(
                weekEvents.filter((e) => focus === "all" || e.client === focus),
                STORY_NOW,
              )}
              scope={focus === "all" ? "All customers" : "One client only"}
              clientOf={(key) =>
                exampleClients.find((c) => c.key === key) ?? {
                  name: "Other",
                  colour: "var(--client-other)",
                }
              }
              now={STORY_NOW}
            />
          ) : v.id === "release" ? (
            <ReleaseStatus doc={releaseDrifted} live now={STORY_NOW} />
          ) : (
            <>
              {v.id === "kestrel" && focus === "all" && (
                <ReleaseStatus doc={releaseDrifted} live now={STORY_NOW} />
              )}
              {v.id === "kestrel" ? (
                <MondayList
                  title="Kestrel Freight · Operations board, mine"
                  page={mondayExample}
                  updatedAt={STORY_NOW}
                  now={STORY_NOW}
                />
              ) : v.id === "halcyon" ? (
                <JiraList
                  title="Halcyon Labs · Jira, assigned to me"
                  doc={jiraExample}
                  folded={new Set(["new"])}
                  onFold={() => undefined}
                  today="2026-03-12"
                  now={STORY_NOW}
                />
              ) : v.id === "meridian" ? (
                <GitHubList
                  title="Meridian Bank · GitHub issues"
                  repo="meridian-bank/ledger"
                  page={githubExample}
                  me="alex-a"
                  mine={false}
                  onMine={() => undefined}
                  folded={new Set()}
                  onFold={() => undefined}
                  colour="var(--client-4)"
                  updatedAt={STORY_NOW}
                  now={STORY_NOW}
                />
              ) : (
                <Panel
                  title={v.label}
                  notes={
                    <Note>This view joins the sidebar in a later step.</Note>
                  }
                />
              )}
            </>
          )}
        </TabPanel>
      ))}
      {opened && (
        <DetailsView
          item={opened}
          clientName={
            exampleClients.find((c) => c.key === opened.customer)?.name ??
            "Other"
          }
          details={
            opened.ref === "db:1"
              ? { state: "ready", page: detailsPage }
              : { state: "none" }
          }
          mondayPrefix="KF"
          weekEnd="2026-03-19"
          now={STORY_NOW}
          openPullRequests={
            opened.ref === "db:1" ? pullCounts(pullsDoc).open : 0
          }
          pullRequests={
            opened.ref === "db:1" && (
              <PullRequests
                doc={pullsDoc}
                trackerKey={opened.key}
                searchable
                now={STORY_NOW}
              />
            )
          }
          onClose={() => setOpened(null)}
        />
      )}
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

/** A task opened from the worklist: its details over the sidebar, Back to return. */
export const Details: Story = {
  args: { theme: "light" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const task = canvas.getByRole("button", { name: /scanner api/i });
    await userEvent.click(task);
    await expect(
      canvas.getByRole("dialog", { name: /scanner api/i }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to Atlas" }),
    );
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(task).toHaveFocus();
  },
};
