import { sampleDataset } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { NeedsYouList } from "./NeedsYouList";
import { storyWorld, WorldFrame } from "./stories/WorldFrame";

const meta = {
  title: "Components/Needs You List",
  component: NeedsYouList,
  args: { dataset: sampleDataset, world: worlds.astronomer, onSelect: fn() },
  render: (args, { globals }) => {
    const id = storyWorld(globals);
    return (
      <WorldFrame world={id}>
        <NeedsYouList {...args} world={worlds[id]} />
      </WorldFrame>
    );
  },
} satisfies Meta<typeof NeedsYouList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /raise the day rate/i }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith("day-rate");
  },
};

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
