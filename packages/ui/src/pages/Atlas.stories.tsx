import {
  busyClientId,
  busyDataset,
  sampleDataset,
  sampleScript,
} from "@atlas/fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, userEvent, within } from "storybook/test";

import { AtlasShell } from "../components/AtlasShell";

/**
 * The whole view, on the invented dataset with its scripted day replaying.
 * Compact is the sidebar pane; Expand fills the screen.
 */
const meta = {
  title: "Pages/Atlas",
  component: AtlasShell,
  parameters: { layout: "fullscreen" },
  // Day unless a story says otherwise, so a test never depends on whether
  // the machine running it is in dark mode.
  args: {
    dataset: sampleDataset,
    script: sampleScript,
    interval: 3.4,
    initialLighting: "day",
  },
} satisfies Meta<typeof AtlasShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** As it sits in the Claude desktop sidebar: a narrow column beside your sessions. */
function Sidebar({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100vh", background: "#101114" }}>
      <div style={{ width: 420, flex: "none", height: "100%" }}>{children}</div>
      <div
        style={{
          flex: 1,
          borderLeft: "1px solid #24262c",
          padding: 24,
          color: "#9a9ca3",
          font: "14px system-ui",
        }}
      >
        <p style={{ margin: 0 }}>Your Claude sessions sit here.</p>
      </div>
    </div>
  );
}

/** Astronomer as it first opens: the compact pane beside your sessions. */
export const AstronomerInTheSidebar: Story = {
  name: "Astronomer, in the Sidebar",
  args: { initialWorld: "astronomer", initialMode: "compact" },
  render: (args) => (
    <Sidebar>
      <AtlasShell {...args} />
    </Sidebar>
  ),
};

/** The same pane in Mariner. */
export const MarinerInTheSidebar: Story = {
  name: "Mariner, in the Sidebar",
  args: { initialWorld: "mariner", initialMode: "compact" },
  render: AstronomerInTheSidebar.render,
};

/** Expanded: the full map with the readout and the log. */
export const AstronomerFullPage: Story = {
  name: "Astronomer, Full Page",
  args: { initialWorld: "astronomer", initialMode: "full" },
};

/** The full page in Mariner. */
export const MarinerFullPage: Story = {
  name: "Mariner, Full Page",
  args: { initialWorld: "mariner", initialMode: "full" },
};

/**
 * A client with about a hundred items, zoomed in. Work is grouped by
 * workstream: a space station each, with at most five of its most urgent
 * items drawn and a count of the rest. Done and unscheduled work stay off
 * the map.
 */
export const AstronomerBusyClient: Story = {
  name: "Astronomer, Busy Client",
  args: {
    dataset: busyDataset,
    script: [],
    initialWorld: "astronomer",
    initialMode: "full",
    initialClient: busyClientId,
  },
};

/** The same busy client in Mariner: a buoy for each workstream, its cargo beside it. */
export const MarinerBusyClient: Story = {
  name: "Mariner, Busy Client",
  args: {
    dataset: busyDataset,
    script: [],
    initialWorld: "mariner",
    initialMode: "full",
    initialClient: busyClientId,
  },
};

/** A question open in the inspector, with Answer first. */
export const InspectingAQuestion: Story = {
  name: "Inspecting a Question",
  args: {
    initialWorld: "astronomer",
    initialMode: "full",
    initialSelection: "alarms-live",
  },
};

/** The folded iPhone Duo: the compact view fills the outer screen. */
export const OnIphoneDuoFolded: Story = {
  name: "On iPhone Duo, Folded",
  args: { initialWorld: "astronomer", initialMode: "compact" },
  globals: { viewport: { value: "iphoneDuoFolded", isRotated: false } },
};

/** Unfolded, there is room for the full map with the inspector beside it. */
export const OnIphoneDuoUnfolded: Story = {
  name: "On iPhone Duo, Unfolded",
  args: {
    initialWorld: "astronomer",
    initialMode: "full",
    initialSelection: "release",
  },
  globals: { viewport: { value: "iphoneDuoUnfolded", isRotated: false } },
};

/** Unfolded and held upright. */
export const OnIphoneDuoUnfoldedUpright: Story = {
  name: "On iPhone Duo, Unfolded Upright",
  args: { initialWorld: "mariner", initialMode: "full" },
  globals: { viewport: { value: "iphoneDuoUnfolded", isRotated: true } },
};

/** The Claude desktop sidebar on a laptop: compact, the full window height. */
export const OnALaptopInTheSidebar: Story = {
  name: "On a Laptop, Sidebar",
  args: { initialWorld: "astronomer", initialMode: "compact" },
  globals: { viewport: { value: "laptopSidebar", isRotated: false } },
};

/** The same laptop with Atlas expanded to the full page. */
export const OnALaptopFullPage: Story = {
  name: "On a Laptop, Full Page",
  args: { initialWorld: "astronomer", initialMode: "full" },
  globals: { viewport: { value: "laptopFullPage", isRotated: false } },
};

/** An iPhone 15: the compact view on a phone that does not fold. */
export const OnAPhone: Story = {
  name: "On an iPhone 15",
  args: { initialWorld: "mariner", initialMode: "compact" },
  globals: { viewport: { value: "iphone15", isRotated: false } },
};

/** Expand opens the full view; Collapse and Escape bring the sidebar back. */
export const ExpandAndCollapse: Story = {
  name: "Expand and Collapse",
  args: { initialWorld: "astronomer", initialMode: "compact", script: [] },
  render: AstronomerInTheSidebar.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /expand/i }));
    await expect(
      canvas.getByRole("button", { name: /collapse/i }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(
      canvas.getByRole("button", { name: /expand/i }),
    ).toBeInTheDocument();
  },
};

/** Choosing a needs-you entry opens the full view on that record. */
export const OpenFromNeedsYou: Story = {
  name: "Open from Needs You",
  args: { initialWorld: "mariner", initialMode: "compact", script: [] },
  render: AstronomerInTheSidebar.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /severity alarms live at go-live/i }),
    );
    const inspector = await canvas.findByRole("complementary", {
      name: /severity alarms live at go-live/i,
    });
    await expect(within(inspector).getByText(/fog bank/i)).toBeInTheDocument();
    await expect(
      within(inspector).getByText(/open question/i),
    ).toBeInTheDocument();
  },
};

/**
 * Connected to a live source, as the web app is to the server's event
 * stream. Here the source sends one event, and it reaches the log.
 */
export const LiveFromTheServer: Story = {
  name: "Live from the Server",
  args: {
    initialWorld: "astronomer",
    initialMode: "full",
    script: [],
    subscribe: (fire) => {
      const timer = window.setTimeout(
        () =>
          fire({
            type: "status-change",
            agentId: "test-runner",
            to: "running",
            text: "Started from the live stream",
          }),
        100,
      );
      return () => window.clearTimeout(timer);
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/started from the live stream/i),
    ).toBeInTheDocument();
  },
};

/**
 * Choosing another record adds a card above the open one instead of
 * replacing it. Each card closes on its own; Collapse hides the stack and
 * Expand brings it back as it was.
 */
export const SeveralRecordsOpen: Story = {
  name: "Several Records Open",
  args: {
    initialWorld: "astronomer",
    initialMode: "full",
    initialSelection: "alarms-live",
    script: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cards = () => canvas.queryAllByRole("complementary");
    const first = await canvas.findByRole("complementary", {
      name: /severity alarms live at go-live/i,
    });
    const linkButtons =
      first.querySelectorAll<HTMLButtonElement>(".atlas-link");
    await expect(linkButtons.length).toBeGreaterThan(0);
    await userEvent.click(linkButtons[0]!);
    await expect(cards()).toHaveLength(2);
    await userEvent.click(
      within(cards()[0]!).getByRole("button", { name: "Close" }),
    );
    await expect(cards()).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", { name: /collapse/i }));
    await expect(cards()).toHaveLength(0);
    await userEvent.click(canvas.getByRole("button", { name: /expand/i }));
    await expect(cards()).toHaveLength(1);
  },
};

/** Answering a question takes it off the needs-you list. */
export const AnswerAQuestion: Story = {
  name: "Answer a Question",
  args: {
    initialWorld: "astronomer",
    initialMode: "full",
    initialSelection: "pilot-build",
    script: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Answer" }));
    await userEvent.click(canvas.getByRole("button", { name: /collapse/i }));
    await expect(
      canvas.queryByRole("button", { name: /^which build runs in the pilot/i }),
    ).not.toBeInTheDocument();
  },
};
