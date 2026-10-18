import { sampleDataset } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Inspector } from "./Inspector";
import { storyWorld, WorldFrame } from "./stories/WorldFrame";

const meta = {
  title: "Components/Inspector",
  component: Inspector,
  args: {
    dataset: sampleDataset,
    world: worlds.astronomer,
    id: "release",
    onClose: fn(),
    onSelect: fn(),
    onAction: fn(),
  },
  render: (args, { globals }) => {
    const id = storyWorld(globals);
    return (
      <WorldFrame world={id}>
        <div style={{ position: "relative", height: 420 }}>
          <Inspector {...args} world={worlds[id]} />
        </div>
      </WorldFrame>
    );
  },
} satisfies Meta<typeof Inspector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AnAgent: Story = { name: "An Agent" };
export const ARequirement: Story = {
  name: "A Requirement",
  args: { id: "one-tenant" },
};
export const ABacklogItem: Story = {
  name: "A Backlog Item",
  args: { id: "cut-over" },
};
export const ADecision: Story = {
  name: "A Decision",
  args: { id: "single-tenant" },
};

export const AQuestion: Story = {
  name: "A Question",
  args: { id: "alarms-live" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/open question/i)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Answer" }));
    await expect(args.onAction).toHaveBeenCalledWith("answer", "alarms-live");
  },
};

/** Buttons keep plain words in every world; only the nouns change. */
export const PlainButtonsInEveryWorld: Story = {
  name: "Plain Buttons in Every World",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ["Open session", "Ask status", "Pause"]) {
      await expect(canvas.getByRole("button", { name })).toBeInTheDocument();
    }
  },
};
