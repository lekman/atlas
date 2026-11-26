import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import "../console.css";
import "../fonts";
import { SectionRail } from ".";

const meta = {
  title: "Components/Console/Section Rail",
  tags: ["autodocs"],
  component: SectionRail,
  args: {
    current: "missions",
    side: "left",
    counts: { beam: 3 },
    onSelect: fn(),
    onSettings: fn(),
  },
  render: (args) => (
    <div className="atlas-console" style={{ height: 640, width: 64 }}>
      <SectionRail {...args} />
    </div>
  ),
} satisfies Meta<typeof SectionRail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The rail with Missions current and three beams waiting. */
export const Default: Story = {};

/** Picking a section reports it; there is no swap button, the edge is a setting. */
export const PickASection: Story = {
  name: "Pick a Section",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Beam/ }));
    await expect(args.onSelect).toHaveBeenCalledWith("beam");
    await expect(
      canvas.queryByRole("button", { name: /^Move the menu/ }),
    ).toBeNull();
  },
};
