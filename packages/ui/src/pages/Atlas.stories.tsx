import {
  busyClientId,
  busyDataset,
  sampleDataset,
  sampleScript,
} from "@atlas/fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

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

/** A question selected: open in the HUD with Answer first, and the map flown to it. */
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

/** Unfolded, there is room for the full map with the selected record in the HUD. */
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

/**
 * A record selected on a phone, where the HUD has no room: the record is a
 * sheet along the bottom, with its buttons.
 */
export const OnAPhoneWithARecordSelected: Story = {
  name: "On an iPhone 15, a Record Selected",
  args: {
    initialWorld: "astronomer",
    initialMode: "full",
    initialSelection: "alarms-live",
    script: [],
  },
  globals: { viewport: { value: "iphone15", isRotated: false } },
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
    const inspector = await canvas.findByRole("article", {
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
 * Choosing a needs-you entry opens it in place in the HUD, with its
 * buttons, and flies the map to it. Choosing another closes the first back
 * to one line: one record is selected at a time.
 */
const selectedInTheHud: Story["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(
    canvas.getByRole("button", { name: /show what needs you/i }),
  );
  await userEvent.click(
    canvas.getByRole("button", { name: /raise the day rate in january/i }),
  );
  const first = await canvas.findByRole("article", {
    name: /raise the day rate in january/i,
  });
  await expect(
    within(first).getByRole("button", { name: "Answer" }),
  ).toBeInTheDocument();
  await expect(
    within(first).getByRole("button", { name: "Details" }),
  ).toBeInTheDocument();
  await userEvent.click(
    canvas.getByRole("button", { name: /severity alarms live at go-live/i }),
  );
  await expect(
    await canvas.findByRole("article", {
      name: /severity alarms live at go-live/i,
    }),
  ).toBeInTheDocument();
  await expect(canvas.getAllByRole("article")).toHaveLength(1);
  await expect(
    canvas.getByRole("button", { name: /raise the day rate in january/i }),
  ).toBeInTheDocument();
};

/** Astronomer: a needs-you entry opens in the HUD; another closes the first. */
export const AstronomerSelectedInTheHud: Story = {
  name: "Astronomer, Selected in the HUD",
  args: { initialWorld: "astronomer", initialMode: "full", script: [] },
  play: selectedInTheHud,
};

/** The same in Mariner, a light world, for the contrast check. */
export const MarinerSelectedInTheHud: Story = {
  name: "Mariner, Selected in the HUD",
  args: { initialWorld: "mariner", initialMode: "full", script: [] },
  play: selectedInTheHud,
};

/**
 * Details opens a blue glass pane over the chart, between the log and the
 * HUD, with every field of the record and the work it links to. Escape
 * closes the pane first and leaves the record selected; a second Escape
 * clears the selection.
 */
const detailsPane: Story["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const selected = await canvas.findByRole("article", {
    name: /severity alarms live at go-live/i,
  });
  await userEvent.click(
    within(selected).getByRole("button", { name: "Details" }),
  );
  const pane = await canvas.findByRole("complementary", {
    name: /details of severity alarms live at go-live/i,
  });
  for (const field of ["Real term", "Client", "State", "Who answers"]) {
    await expect(within(pane).getByText(field)).toBeInTheDocument();
  }
  await expect(
    within(pane).getByRole("button", { name: /rehearse the tenant cut-over/i }),
  ).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await expect(canvas.queryByRole("complementary")).not.toBeInTheDocument();
  await expect(
    canvas.getByRole("article", { name: /severity alarms live at go-live/i }),
  ).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await expect(canvas.queryByRole("article")).not.toBeInTheDocument();
};

/** Astronomer: Details opens the pane, and Escape closes it. */
export const AstronomerDetailsPane: Story = {
  name: "Astronomer, Details Pane",
  args: {
    initialWorld: "astronomer",
    initialMode: "full",
    initialSelection: "alarms-live",
    script: [],
  },
  play: detailsPane,
};

/** The pane in Mariner: the same blue glass over a light chart. */
export const MarinerDetailsPane: Story = {
  name: "Mariner, Details Pane",
  args: {
    initialWorld: "mariner",
    initialMode: "full",
    initialSelection: "alarms-live",
    script: [],
  },
  play: detailsPane,
};

/**
 * The full map opens on home, in the middle of the canvas, and a click on
 * empty space goes back there. The Astronomer's HUD gives the world point
 * at the canvas centre, and home sits at the origin, so the readout says
 * X 0.000 Y 0.000 when home is centred.
 */
export const CentredOnHome: Story = {
  name: "Centred on Home",
  args: { initialWorld: "astronomer", initialMode: "full", script: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const map = canvas.getByRole("img", { name: /astronomer map/i });
    const readout = () =>
      canvasElement.querySelector(".atlas-hud-readout")?.textContent ?? "";
    const centred = /X -?0\.000\s+Y -?0\.000/;
    await waitFor(() => expect(readout()).toMatch(centred), { timeout: 4000 });
    // Pan far off the map, so the click below lands on empty space.
    const box = map.getBoundingClientRect();
    const point = { clientX: box.left + 200, clientY: box.top + 300 };
    map.dispatchEvent(
      new WheelEvent("wheel", {
        ...point,
        deltaX: 6000,
        deltaY: 0,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => expect(readout()).not.toMatch(centred), {
      timeout: 2000,
    });
    await userEvent.pointer([
      { keys: "[MouseLeft]", target: map, coords: point },
    ]);
    await waitFor(() => expect(readout()).toMatch(centred), { timeout: 4000 });
    await expect(canvas.queryByRole("article")).not.toBeInTheDocument();
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
