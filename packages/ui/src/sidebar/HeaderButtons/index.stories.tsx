import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { HeaderButtons } from ".";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Frame/Header Buttons",
  component: HeaderButtons,
  tags: ["autodocs"],
  args: { soundOn: false, onSound: fn(), onSettings: fn() },
  render: function Render(args, { globals }) {
    const [on, setOn] = useState(args.soundOn);
    return (
      <SidebarStoryFrame globals={globals} world="astronomer">
        <div className="top">
          <HeaderButtons
            {...args}
            soundOn={on}
            onSound={() => {
              setOn(!on);
              args.onSound();
            }}
          />
        </div>
      </SidebarStoryFrame>
    );
  },
} satisfies Meta<typeof HeaderButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sound on the left, settings on the right, as on the full page. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const sound = canvas.getByRole("button", { name: "Sound" });
    await expect(sound).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(sound);
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Settings" }));
    await expect(args.onSettings).toHaveBeenCalledOnce();
  },
};
