import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import "../console.css";
import "../fonts";
import { storyFleets } from "../stories/ConsoleStoryFrame";
import { TopBar } from ".";

const meta = {
  title: "Components/Console/Top Bar",
  tags: ["autodocs"],
  component: TopBar,
  args: {
    fleets: storyFleets,
    fleetId: "work",
    score: 21,
    relay: { kind: "live" },
    onFleetChange: fn(),
  },
  render: (args) => (
    <div className="atlas-console" style={{ width: 466 }}>
      <TopBar {...args} />
    </div>
  ),
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Live, with the work fleet picked. */
export const Live: Story = {};

/** The relay is down and the page shows the stored copy. */
export const StoredCopy: Story = {
  name: "Stored Copy",
  args: { relay: { kind: "stored" } },
};

/** Short fleet names for a narrow screen; the full name stays the button's label. */
export const Compact: Story = { args: { compact: true } };

/** Picking the other fleet reports it. */
export const SwitchFleet: Story = {
  name: "Switch Fleet",
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Personal/ }),
    );
    await expect(args.onFleetChange).toHaveBeenCalledWith("personal");
  },
};
