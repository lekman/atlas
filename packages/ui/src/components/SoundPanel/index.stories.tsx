import { defaultSoundSettings } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { SoundPanel } from ".";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

const meta = {
  title: "Components/Sound Panel",
  component: SoundPanel,
  tags: ["autodocs"],
  args: { settings: defaultSoundSettings, onChange: fn(), onPreview: fn() },
  render: (args, { globals }) => (
    <WorldFrame world={storyWorld(globals)} lighting={storyLighting(globals)}>
      <SoundPanel {...args} />
    </WorldFrame>
  ),
} satisfies Meta<typeof SoundPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Off, as every reader first finds it. Turning it on is a choice. */
export const OffByDefault: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const master = canvas.getByRole("checkbox", { name: "Sound on" });
    await expect(master).not.toBeChecked();
    await userEvent.click(master);
    await expect(args.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  },
};

/** Turned on, with outside systems switched off. */
export const OnWithoutOutsideSystems: Story = {
  args: {
    settings: {
      ...defaultSoundSettings,
      enabled: true,
      categories: { ...defaultSoundSettings.categories, external: false },
    },
  },
};
