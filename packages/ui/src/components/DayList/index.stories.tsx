import { sampleDataset, sampleDayPlan } from "@atlas/fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DayList } from ".";
import { EveryWorld } from "../../stories/EveryWorld";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

const meta = {
  title: "Components/Day List",
  tags: ["autodocs"],
  component: DayList,
  args: {
    plan: sampleDayPlan,
    clients: sampleDataset.clients,
    onSelect: fn(),
  },
  render: (args, { globals }) => (
    <WorldFrame
      world={storyWorld(globals)}
      lighting={storyLighting(globals)}
      width={560}
    >
      <DayList {...args} />
    </WorldFrame>
  ),
} satisfies Meta<typeof DayList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The whole invented day: every band, home first, notes and meetings, and
 * each kind of task (sized, unsized, blocked, carried over, not worth it, done).
 */
export const TheDay: Story = {
  name: "The Day",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const band of ["Today", "Tomorrow", "Future", "Unscheduled"]) {
      await expect(
        canvas.getByRole("heading", { level: 2, name: new RegExp(`^${band}`) }),
      ).toBeInTheDocument();
    }
    await expect(canvas.getAllByText("Blocked").length).toBeGreaterThan(0);
    await expect(canvas.getByText(/Carried over from/)).toBeInTheDocument();
    await expect(canvas.getAllByText("Not worth it:").length).toBe(1);
  },
};

/** Picking a task reports its id and nothing else. */
export const SelectingATask: Story = {
  name: "Selecting a Task",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Rehearse the tenant cut-over" }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith("rehearse-cut-over");
  },
};

/** The open task is marked as current, beside the reader. */
export const WithATaskOpen: Story = {
  name: "With a Task Open",
  args: { selectedId: "rehearse-cut-over" },
};

/** Done work sinks below what is left in its client's block, struck through. */
export const DoneSinks: Story = {
  name: "Done Sinks",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const block = canvas
      .getAllByRole("heading", { level: 3, name: "Halcyon Labs" })[0]
      ?.closest("section");
    if (!block) throw new Error("no Halcyon Labs block today");
    const titles = within(block as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.textContent);
    await expect(titles.at(-1)).toBe("Done: Fix the flaky sign-in test");
    await expect(titles.at(-2)).toBe("Rewrite reporting in a new framework");
  },
};

/** Today in each world's palette, so the light worlds are checked too. */
export const InEveryWorld: Story = {
  name: "In Every World",
  args: {
    plan: {
      ...sampleDayPlan,
      items: sampleDayPlan.items.filter(
        (item) => item.clientId === "halcyon" || item.clientId === "ashgrove",
      ),
    },
  },
  render: (args) => (
    <EveryWorld width={560}>{() => <DayList {...args} />}</EveryWorld>
  ),
};
