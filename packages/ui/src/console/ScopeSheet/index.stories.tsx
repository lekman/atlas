import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { ScopeSheet } from ".";

const meta = {
  title: "Components/Console/Scope Sheet",
  tags: ["autodocs"],
  component: ScopeSheet,
  args: {
    systems: [
      { system: "halcyon", name: "Halcyon Labs", count: 2 },
      { system: "kestrel", name: "Kestrel Freight", count: 4 },
      { system: "larchwood", name: "Larchwood Studio", count: 0 },
    ],
    scope: null,
    total: 6,
    onPick: fn(),
    onCancel: fn(),
  },
  render: (args) => (
    <ConsoleComponentFrame width={402}>
      <div style={{ height: 420 }}>
        <ScopeSheet {...args} />
      </div>
    </ConsoleComponentFrame>
  ),
} satisfies Meta<typeof ScopeSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All systems picked, each system with its open tasks in the range. */
export const AllSystems: Story = { name: "All Systems" };

/** One system picked: it is marked, and focus starts on it. */
export const OneSystem: Story = {
  name: "One System",
  args: { scope: "kestrel" },
};

/** A system reports its key; All systems reports null. */
export const Pick: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /^Kestrel Freight/ }),
    );
    await expect(args.onPick).toHaveBeenCalledWith("kestrel");
    await userEvent.click(canvas.getByRole("button", { name: /^All systems/ }));
    await expect(args.onPick).toHaveBeenCalledWith(null);
  },
};
