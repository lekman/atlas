import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { worklistItems } from "../../sidebar/stories/worklist";
import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { TaskRow } from ".";

const meta = {
  title: "Components/Console/Task Row",
  tags: ["autodocs"],
  component: TaskRow,
  args: { task: worklistItems[0]!, onSelect: fn(), onMove: fn() },
  render: (args) => (
    <ConsoleComponentFrame>
      <ul className="console-tasks">
        <TaskRow {...args} />
      </ul>
    </ConsoleComponentFrame>
  ),
} satisfies Meta<typeof TaskRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In progress: a ring, its grade, effort and ticket. */
export const InProgress: Story = { name: "In Progress" };

/** Queued: a dashed ring. */
export const Queued: Story = {
  args: { task: { ...worklistItems[1]!, flags: [] } },
};

/** Blocked: a coral square. */
export const Blocked: Story = {
  args: { task: { ...worklistItems[1]!, flags: ["blocked"] } },
};

/** Done: a filled circle, the title struck through and no move control. */
export const Done: Story = {
  args: { task: { ...worklistItems[1]!, done: true } },
};

/** Selected, as it is while its detail is open. */
export const Selected: Story = { args: { selected: true } };

/** The title opens the task and the move control asks to move it; they are separate buttons. */
export const OpenOrMove: Story = {
  name: "Open or Move",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /^In progress:/ }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith(args.task);
    await userEvent.click(
      canvas.getByRole("button", { name: `Move ${args.task.title}` }),
    );
    await expect(args.onMove).toHaveBeenCalledWith(args.task);
  },
};
