import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { KeyPanel } from ".";
import { storyWorld, WorldFrame } from "../../stories/WorldFrame";

const meta = {
  title: "Components/Key Panel",
  component: KeyPanel,
  tags: ["autodocs"],
  args: { world: worlds.astronomer },
  render: (_args, { globals }) => (
    <WorldFrame world={storyWorld(globals)}>
      <KeyPanel world={worlds[storyWorld(globals)]} />
    </WorldFrame>
  ),
} satisfies Meta<typeof KeyPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The world chosen in the toolbar, explained in plain words. Every record
 * type has a row, so nothing on the map is a mystery.
 */
export const ForTheChosenWorld: Story = {
  name: "For the Chosen World",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const term of ["Client", "Agent", "Open question", "Decision"]) {
      await expect(
        canvas.getByRole("rowheader", { name: term }),
      ).toBeInTheDocument();
    }
  },
};
