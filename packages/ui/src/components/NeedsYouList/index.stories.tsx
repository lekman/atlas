import { sampleDataset } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { NeedsYouList } from ".";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

const meta = {
  title: "Components/Needs You List",
  tags: ["autodocs"],
  component: NeedsYouList,
  args: { dataset: sampleDataset, world: worlds.astronomer, onSelect: fn() },
  render: (args, { globals }) => {
    const id = storyWorld(globals);
    return (
      <WorldFrame world={id} lighting={storyLighting(globals)}>
        <NeedsYouList {...args} world={worlds[id]} />
      </WorldFrame>
    );
  },
} satisfies Meta<typeof NeedsYouList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The sample day: questions only you can answer first, then agents waiting,
 * blocked or failed. Picking one opens it.
 */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /raise the day rate/i }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith("day-rate");
  },
};

/** Nothing needs you, which the list says rather than going blank. */
export const NothingWaiting: Story = {
  name: "Nothing Waiting",
  args: {
    dataset: {
      ...sampleDataset,
      questions: [],
      agents: sampleDataset.agents.map((agent) => ({
        ...agent,
        status: "running" as const,
      })),
    },
  },
};
