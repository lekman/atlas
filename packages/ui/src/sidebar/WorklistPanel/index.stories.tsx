import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Worklist } from ".";
import { ActionMenu } from "../ActionMenu";
import { exampleClients } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";
import {
  STORY_TODAY,
  STORY_TOMORROW,
  worklistItems,
} from "../stories/worklist";
import type { Band } from "../worklist/model";

const meta = {
  title: "Sidebar/Worklist/Worklist",
  component: Worklist,
  tags: ["autodocs"],
  args: {
    items: worklistItems,
    band: "today",
    onBand: () => undefined,
    clients: exampleClients,
    focus: "all",
    folded: new Set<string>(),
    onFold: () => undefined,
    showDone: false,
    showWaiting: true,
    today: STORY_TODAY,
    tomorrow: STORY_TOMORROW,
  },
  render: function Render(args, { globals }) {
    const [band, setBand] = useState<Band>(args.band);
    const [folded, setFolded] = useState(new Set(args.folded));
    const [showDone, setShowDone] = useState(args.showDone);
    return (
      <SidebarStoryFrame globals={globals}>
        <Worklist
          {...args}
          band={band}
          onBand={setBand}
          folded={folded}
          onFold={(key) => {
            const next = new Set(folded);
            if (!next.delete(key)) next.add(key);
            setFolded(next);
          }}
          showDone={showDone}
          menu={
            <ActionMenu
              what="the worklist"
              actions={[
                {
                  label: `${showDone ? "Hide" : "Show"} done (1)`,
                  onSelect: () => setShowDone(!showDone),
                },
                {
                  label: "Collapse to clients",
                  hint: "In every view: each client closed; in Backlog, quadrants stay open",
                },
                { label: "Expand all" },
              ]}
            />
          }
        />
      </SidebarStoryFrame>
    );
  },
} satisfies Meta<typeof Worklist>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Today, grouped by client in the configured order. Each group shows five
 * tasks until it is opened in full; groups fold. Done tasks hide until
 * the menu shows them.
 */
export const Today: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Depot stand-up")).toBeNull();
    await expect(
      canvas.queryByText("Archive last year's delivery notes"),
    ).toBeNull();
    await expect(
      canvas.getByText("3 open · 1 done hidden"),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Show 1 more" }));
    await expect(canvas.getByText("Order a new keyboard")).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: /Kestrel Freight/ }),
    );
    await expect(canvas.queryByText(/scanner api/i)).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for the worklist" }),
    );
    await userEvent.click(canvas.getByRole("menuitem", { name: /show done/i }));
    await userEvent.click(
      canvas.getByRole("button", { name: /Kestrel Freight/ }),
    );
    await expect(
      canvas.getByText("Archive last year's delivery notes"),
    ).toBeInTheDocument();
  },
};

/** Tomorrow, with each task's day. */
export const Tomorrow: Story = {
  args: { band: "tomorrow" },
};

/**
 * The backlog: every open task by Covey quadrant, then by client, under a
 * bar that weighs today's graded work against an eight-hour day, red when
 * it is over. The i explains a quadrant.
 */
export const Backlog: Story = {
  args: { band: "backlog" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("14.5h of 8h graded")).toHaveClass("over");
    await userEvent.click(canvas.getByRole("button", { name: "About Q2" }));
    await expect(
      canvas.getByText(/plan these in before they turn urgent/i),
    ).toBeInTheDocument();
    await expect(canvas.getAllByText("today").length).toBeGreaterThan(0);
  },
};

/** One client chosen: its group always open, every task shown. */
export const OneClient: Story = {
  name: "One Client",
  args: { focus: "ashgrove" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("button", { name: /show \d more/i }),
    ).toBeNull();
    await expect(canvas.getByText("Order a new keyboard")).toBeInTheDocument();
  },
};

/** Approved and merged tasks hidden from the menu. */
export const WithoutWaiting: Story = {
  name: "Without Waiting",
  args: { showWaiting: false },
};

/** No worklist on this device yet. */
export const NoWorklist: Story = {
  name: "No Worklist",
  args: {
    items: null,
    empty:
      "No worklist yet. Open this page in the Claude desktop app on your Mac, or wait for the scheduled sync.",
  },
};

/** Before the first answer. */
export const Loading: Story = {
  args: { items: null, loading: true },
};
