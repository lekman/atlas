import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { worklistItems } from "../../sidebar/stories/worklist";
import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { MoveSheet } from ".";

const meta = {
  title: "Components/Console/Move Sheet",
  tags: ["autodocs"],
  component: MoveSheet,
  args: {
    task: worklistItems[1]!,
    to: ["tomorrow", "backlog"],
    onMove: fn(),
    onCancel: fn(),
  },
  render: (args) => (
    <div style={{ height: 420 }}>
      <ConsoleComponentFrame width={402}>
        <div style={{ height: 380 }}>
          <MoveSheet {...args} />
        </div>
      </ConsoleComponentFrame>
    </div>
  ),
} satisfies Meta<typeof MoveSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Moving a task from today: Tomorrow or the backlog, or Cancel. */
export const FromToday: Story = { name: "From Today" };

/** The relay is not live, so the sheet says the move waits for the Mac mini. */
export const Queued: Story = { args: { queued: true } };

/** A choice reports the task and the range; Escape cancels. */
export const PickOrCancel: Story = {
  name: "Pick or Cancel",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Backlog" }));
    await expect(args.onMove).toHaveBeenCalledWith(args.task, "backlog");
    await userEvent.keyboard("{Escape}");
    await expect(args.onCancel).toHaveBeenCalled();
  },
};
