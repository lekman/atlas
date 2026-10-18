import { worldIds, worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { WorldPicker } from ".";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

const meta = {
  title: "Components/World Picker",
  component: WorldPicker,
  tags: ["autodocs"],
  args: {
    current: "astronomer",
    onChange: fn(),
    lighting: "automatic",
    onLightingChange: fn(),
  },
  render: (args, { globals }) => (
    <WorldFrame world={storyWorld(globals)} lighting={storyLighting(globals)}>
      <WorldPicker {...args} current={storyWorld(globals)} />
    </WorldFrame>
  ),
} satisfies Meta<typeof WorldPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every built world, with the one in use marked. Picking one reports it
 * and changes nothing itself: the shell decides what a pick means.
 */
export const EveryWorld: Story = {
  play: async ({ canvasElement, args, globals }) => {
    const canvas = within(canvasElement);
    for (const id of worldIds) {
      await expect(
        canvas.getByRole("button", { name: new RegExp(worlds[id].name, "i") }),
      ).toBeEnabled();
    }
    const other = worldIds.find((id) => id !== storyWorld(globals));
    if (!other) return;
    await userEvent.click(
      canvas.getByRole("button", { name: new RegExp(worlds[other].name, "i") }),
    );
    await expect(args.onChange).toHaveBeenCalledWith(other);
  },
};

/**
 * Lighting follows the device until the reader picks Day or Night. The
 * choice is reported; the shell applies it.
 */
export const ChooseNight: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("radio", { name: "Automatic" }),
    ).toBeChecked();
    await userEvent.click(canvas.getByRole("radio", { name: "Night" }));
    await expect(args.onLightingChange).toHaveBeenCalledWith("night");
  },
};
