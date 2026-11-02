import {
  defaultSoundSettings,
  type LightingPreference,
  type SoundSettings,
} from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { SettingsView } from ".";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";
import type { SidebarWorldId } from "../theme/worlds";

const meta = {
  title: "Sidebar/Settings",
  component: SettingsView,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    world: "astronomer",
    onWorld: fn(),
    lighting: "automatic",
    onLighting: fn(),
    deviceIsDark: true,
    sound: defaultSoundSettings,
    onSound: fn(),
    onPreview: fn(),
    sync: { text: "Live", title: "Read live from the Mac" },
    onClose: fn(),
  },
  render: function Render(args, { globals }) {
    const [world, setWorld] = useState<SidebarWorldId>(args.world);
    const [lighting, setLighting] = useState<LightingPreference>(args.lighting);
    const [sound, setSound] = useState<SoundSettings>(args.sound);
    return (
      <SidebarStoryFrame globals={globals} world={world}>
        <div style={{ position: "relative", minHeight: 640 }}>
          <SettingsView
            {...args}
            world={world}
            onWorld={(w) => {
              setWorld(w);
              args.onWorld(w);
            }}
            lighting={lighting}
            onLighting={setLighting}
            sound={sound}
            onSound={setSound}
          />
        </div>
      </SidebarStoryFrame>
    );
  },
} satisfies Meta<typeof SettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Astronomer chosen. Astronomer has no night, so there is no lighting choice. */
export const Astronomer: Story = {
  globals: { lighting: "night" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Worklist: Live")).toBeVisible();
    await expect(
      canvas.getByRole("radio", { name: /astronomer/i }),
    ).toBeChecked();
  },
};

/** Mariner chosen, with its day and night lighting. */
export const Mariner: Story = {
  args: { world: "mariner", deviceIsDark: false },
};

/** Choosing a world calls back with it; Back closes the screen. */
export const ChooseMariner: Story = {
  name: "Choose Mariner",
  globals: { lighting: "night" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: /mariner/i }));
    await expect(args.onWorld).toHaveBeenCalledWith("mariner");
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to Atlas" }),
    );
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};
