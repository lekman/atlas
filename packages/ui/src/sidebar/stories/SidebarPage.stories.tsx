import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createFakeRuntime,
  openTaskDetails,
  Runtime,
  type FakeHostOptions,
  type FakeRuntime,
  type Host,
} from "@atlas/runtime";
import {
  defaultSoundSettings,
  type LightingPreference,
  type SoundSettings,
} from "@atlas/worlds";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Agenda } from "../Agenda";
import { agendaDays } from "../calendar/model";
import { ClientPill } from "../ClientPill";
import { DecisionsView } from "../DecisionsView";
import { DetailsView } from "../DetailsView";
import { pullCounts } from "../details/pulls";
import { PullRequests } from "../PullRequests";
import { hostsTab } from "../hosts/model";
import { GitHubList } from "../GitHubList";
import { HeaderButtons } from "../HeaderButtons";
import { HostsPanel } from "../HostsPanel";
import { JiraList } from "../JiraList";
import { MondayList } from "../MondayList";
import { NextUp } from "../NextUp";
import { Note } from "../Note";
import { Panel } from "../Panel";
import { SidebarFrame } from "../SidebarFrame";
import { SettingsView } from "../SettingsView";
import { SidebarHeader } from "../SidebarHeader";
import type { SidebarWorldId } from "../theme/worlds";
import { releaseCount } from "../release/model";
import { ReleaseStatus } from "../ReleaseStatus";
import { ItemActions } from "../ItemActions";
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
import { guards, repeatedAsks, rules } from "./decisions";
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
  initialWorld,
  host = null,
}: {
  initialFocus?: string;
  theme: "light" | "dark";
  /** A world's look; without one the page keeps the neutral theme and the Live label. */
  initialWorld?: SidebarWorldId;
  /** VS Code's host, which opens a task's details in an editor tab instead of here. */
  host?: Host | null;
}) {
  const [world, setWorld] = useState(initialWorld);
  const [lighting, setLighting] = useState<LightingPreference>(
    theme === "dark" ? "night" : "day",
  );
  const [sound, setSound] = useState<SoundSettings>(defaultSoundSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teachOpen, setTeachOpen] = useState(false);
  const resolved =
    lighting === "automatic" ? (theme === "dark" ? "night" : "day") : lighting;
  const [focus, setFocus] = useState(initialFocus);
  const [view, setView] = useState("worklist");
  const [band, setBand] = useState<Band>("today");
  const [opened, setOpened] = useState<WorkItem | null>(null);
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const shown = visibleViews(exampleViews, focus, view);
  return (
    <SidebarFrame
      theme={theme}
      fill
      world={
        world
          ? { id: world, lighting: world === "mariner" ? resolved : "day" }
          : undefined
      }
    >
      <SidebarHeader
        now={STORY_NOW}
        sync={{ liveAt: STORY_NOW.getTime() - 20000, syncedAt: null }}
        controls={
          world ? (
            <HeaderButtons
              soundOn={sound.enabled}
              onSound={() => setSound({ ...sound, enabled: !sound.enabled })}
              onSettings={() => setSettingsOpen(true)}
            />
          ) : undefined
        }
      />
      {teachOpen && (
        <DecisionsView
          asks={repeatedAsks}
          rules={rules}
          guards={guards}
          onAdopt={() => {}}
          onKeepAsking={() => {}}
          onRuleMode={() => {}}
          now={STORY_NOW}
          onClose={() => setTeachOpen(false)}
        />
      )}
      {world && settingsOpen && (
        <SettingsView
          world={world}
          onWorld={setWorld}
          lighting={lighting}
          onLighting={setLighting}
          deviceIsDark={theme === "dark"}
          sound={sound}
          onSound={setSound}
          onPreview={() => {}}
          sync={{ text: "Live", title: "Read live from the Mac" }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
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
              onOpen={(item) => {
                openTaskDetails(host, item.ref, () => setOpened(item)).catch(
                  () => undefined,
                );
              }}
              notes={
                <WaitingOnYou
                  operator={OPERATOR}
                  onTeach={() => setTeachOpen(true)}
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

/**
 * The page in a VS Code editor tab of its own: one task's details at the
 * tab's full width, with no tabs, worklist or Back button.
 */
function DetailsTabPage({ theme }: { theme: "light" | "dark" }) {
  const item = worklistItems[0]!;
  return (
    <SidebarFrame theme={theme} fill>
      <DetailsView
        item={item}
        clientName={
          exampleClients.find((c) => c.key === item.customer)?.name ?? "Other"
        }
        details={{ state: "ready", page: detailsPage }}
        mondayPrefix="KF"
        weekEnd="2026-03-19"
        now={STORY_NOW}
        openPullRequests={pullCounts(pullsDoc).open}
        actions={
          <ItemActions
            groups={[
              [
                {
                  icon: "play",
                  label: "Execute: dispatch to the owner",
                  primary: true,
                  onSelect: () => undefined,
                },
                {
                  icon: "pulse",
                  label: "Status: ask the owner where this stands",
                  onSelect: () => undefined,
                },
              ],
              [
                { icon: "check", label: "Done", onSelect: () => undefined },
                {
                  icon: "right",
                  label: "Move to tomorrow",
                  onSelect: () => undefined,
                },
              ],
            ]}
          />
        }
        pullRequests={
          <PullRequests
            doc={pullsDoc}
            trackerKey={item.key}
            searchable
            now={STORY_NOW}
          />
        }
      />
    </SidebarFrame>
  );
}

/** A stand-in for VS Code's host, and the page's view of it, for a story's loader. */
async function fakeHost(
  options: FakeHostOptions,
): Promise<{ fake: FakeRuntime; host: Host | null }> {
  const fake = createFakeRuntime({ host: options });
  return { fake, host: await new Runtime(fake).host() };
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

/**
 * In VS Code, a task opens in an editor tab, where there is room for its
 * details, and the sidebar stays on the worklist.
 */
export const OpensInTheEditor: Story = {
  name: "Opens in the Editor",
  args: { theme: "light" },
  loaders: [() => fakeHost({})],
  render: (args, { globals, loaded }) => (
    <SidebarPage
      {...args}
      host={(loaded as { host: Host | null }).host}
      theme={globals.lighting === "night" ? "dark" : "light"}
    />
  ),
  play: async ({ canvasElement, loaded }) => {
    const { fake } = loaded as { fake: FakeRuntime };
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /scanner api/i }));
    await waitFor(() => expect(fake.opened).toEqual(["db:1"]));
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(
      canvas.getByRole("tab", { name: /worklist/i }),
    ).toHaveAttribute("aria-selected", "true");
  },
};

/**
 * When the editor cannot open the tab, the details open in the sidebar as
 * they do everywhere else, so the click is not lost.
 */
export const EditorRefuses: Story = {
  name: "Editor Refuses",
  args: { theme: "light" },
  loaders: [() => fakeHost({ refuse: "upstream_error" })],
  render: (args, { globals, loaded }) => (
    <SidebarPage
      {...args}
      host={(loaded as { host: Host | null }).host}
      theme={globals.lighting === "night" ? "dark" : "light"}
    />
  ),
  play: async ({ canvasElement, loaded }) => {
    const { fake } = loaded as { fake: FakeRuntime };
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /scanner api/i }));
    await expect(
      await canvas.findByRole("dialog", { name: /scanner api/i }),
    ).toBeVisible();
    await expect(fake.opened).toEqual(["db:1"]);
  },
};

/**
 * The editor tab a task opens in: its details alone, across the tab's
 * width, with the title as the page's heading and no Back button.
 */
export const DetailsTab: Story = {
  name: "Details Tab",
  args: { theme: "light" },
  globals: { viewport: { value: "laptopFullPage", isRotated: false } },
  render: (_args, { globals }) => (
    <DetailsTabPage theme={globals.lighting === "night" ? "dark" : "light"} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 1, name: /scanner api/i }),
    ).toBeVisible();
    await expect(canvas.getByRole("main")).toBeVisible();
    await expect(canvas.queryByRole("tablist")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Back to Atlas" }),
    ).toBeNull();
    await expect(canvas.queryByRole("dialog")).toBeNull();
  },
};

/** The Astronomer world: the full page's star field and typefaces in the sidebar. */
export const Astronomer: Story = {
  args: { theme: "dark", initialWorld: "astronomer" },
  globals: { lighting: "night" },
};

/** The Mariner world by day, on parchment. */
export const MarinerDay: Story = {
  name: "Mariner Day",
  args: { theme: "light", initialWorld: "mariner" },
};

/** The Mariner world at night. */
export const MarinerNight: Story = {
  name: "Mariner Night",
  args: { theme: "dark", initialWorld: "mariner" },
  globals: { lighting: "night" },
};

/**
 * The settings button opens the full page's settings over the sidebar.
 * Choosing Mariner changes the world, and Escape returns to the worklist.
 */
export const ChooseAWorld: Story = {
  name: "Choose a World",
  args: { theme: "dark", initialWorld: "astronomer" },
  globals: { lighting: "night" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const settings = canvas.getByRole("button", { name: "Settings" });
    await userEvent.click(settings);
    const dialog = canvas.getByRole("dialog", { name: "Settings" });
    await expect(within(dialog).getByText("Worklist: Live")).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /mariner/i }),
    );
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(canvasElement.querySelector(".atlas-sidebar")).toHaveAttribute(
      "data-world",
      "mariner",
    );
    await expect(settings).toHaveFocus();
  },
};

/** The icon in Waiting on You opens Teach Commander; Back returns to it. */
export const TeachCommander: Story = {
  name: "Teach Commander",
  args: { theme: "light" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const teach = canvas.getByRole("button", {
      name: /Teach Commander, \d+ waiting/,
    });
    await userEvent.click(teach);
    await expect(
      canvas.getByRole("dialog", { name: "Teach Commander" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to Atlas" }),
    );
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(teach).toHaveFocus();
  },
};
