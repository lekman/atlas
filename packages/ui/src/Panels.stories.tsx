import { defaultSoundSettings, worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { KeyPanel, SoundPanel, WorldPicker } from "./Panels";
import { storyWorld, WorldFrame } from "./stories/WorldFrame";

/** The three panels the header opens. */
const meta = {
  title: "Components/Header Panels",
  component: WorldPicker,
  args: { current: "astronomer", onChange: fn() },
} satisfies Meta<typeof WorldPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const World: Story = {
  render: (args, { globals }) => (
    <WorldFrame world={storyWorld(globals)}>
      <WorldPicker {...args} current={storyWorld(globals)} />
    </WorldFrame>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /mariner/i }));
    await expect(args.onChange).toHaveBeenCalledWith("mariner");
    await expect(
      canvas.getByRole("button", { name: /woodsman/i }),
    ).toBeDisabled();
  },
};

export const Key: Story = {
  render: (_args, { globals }) => (
    <WorldFrame world={storyWorld(globals)}>
      <KeyPanel world={worlds[storyWorld(globals)]} />
    </WorldFrame>
  ),
};

export const Sound: Story = {
  render: (_args, { globals }) => (
    <WorldFrame world={storyWorld(globals)}>
      <SoundPanel
        settings={defaultSoundSettings}
        onChange={fn()}
        onPreview={fn()}
      />
    </WorldFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("checkbox", { name: "Sound on" }),
    ).not.toBeChecked();
  },
};
