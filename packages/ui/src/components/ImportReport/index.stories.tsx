import { sampleDataset, sampleImportReport } from "@atlas/fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ImportReport } from ".";
import { EveryWorld } from "../../stories/EveryWorld";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

const meta = {
  title: "Components/Import Report",
  tags: ["autodocs"],
  component: ImportReport,
  args: {
    report: sampleImportReport,
    clients: sampleDataset.clients,
    onImport: fn(),
  },
  render: (args, { globals }) => (
    <WorldFrame
      world={storyWorld(globals)}
      lighting={storyLighting(globals)}
      width={560}
    >
      <ImportReport {...args} />
    </WorldFrame>
  ),
} satisfies Meta<typeof ImportReport>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The dry run of the invented dashboard: counts, the lines it could not
 * place, two held back by number only, and four tasks waiting for a size.
 * Import reports the press and does nothing else.
 */
export const DryRun: Story = {
  name: "Dry Run",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/58 and 203/)).toBeInTheDocument();
    await expect(canvas.getByText("Line 112")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Import" }));
    await expect(args.onImport).toHaveBeenCalledOnce();
  },
};

/** A clean dashboard: every line placed, nothing held back, everything sized. */
export const Clean: Story = {
  args: {
    report: {
      ...sampleImportReport,
      unplaced: [],
      heldBack: [],
      waitingForSize: [],
    },
  },
};

/** The dry run in each world's palette. */
export const InEveryWorld: Story = {
  name: "In Every World",
  render: (args) => (
    <EveryWorld width={560}>{() => <ImportReport {...args} />}</EveryWorld>
  ),
};
