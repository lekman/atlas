import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { worklistItems } from "../../sidebar/stories/worklist";
import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { TaskSummary } from ".";

const meta = {
  title: "Components/Console/Task Summary",
  tags: ["autodocs"],
  component: TaskSummary,
  args: {
    task: worklistItems[0]!,
    systemName: "Kestrel Freight",
    onDone: fn(),
    onMove: fn(),
  },
  render: (args) => (
    <ConsoleComponentFrame width={445}>
      <TaskSummary {...args} />
    </ConsoleComponentFrame>
  ),
} satisfies Meta<typeof TaskSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A task in progress, with its grade, ticket and agent. */
export const InProgress: Story = { name: "In Progress" };

/** Done and Move report the task. */
export const DoneOrMove: Story = {
  name: "Done or Move",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await expect(args.onDone).toHaveBeenCalledWith(args.task);
    await userEvent.click(canvas.getByRole("button", { name: "Move" }));
    await expect(args.onMove).toHaveBeenCalledWith(args.task);
  },
};
