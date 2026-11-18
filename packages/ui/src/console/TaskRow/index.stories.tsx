import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { worklistItems } from "../../sidebar/stories/worklist";
import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { TaskRow } from ".";

const meta = {
  title: "Components/Console/Task Row",
  tags: ["autodocs"],
  component: TaskRow,
  args: {
    task: worklistItems[0]!,
    onSelect: fn(),
    actions: [
      { label: "Copy reference" },
      { label: "Done", divider: true },
      { label: "Move to Tomorrow" },
      { label: "Move to Backlog" },
      { label: "Status", divider: true },
      { label: "Execute" },
    ],
  },
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

/** The title opens the task; Actions opens the menu, a separate button. */
export const OpenOrActions: Story = {
  name: "Open or Actions",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /^In progress:/ }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith(args.task);
    await userEvent.click(
      canvas.getByRole("button", { name: `Actions for ${args.task.title}` }),
    );
    await expect(
      canvas.getByRole("menuitem", { name: "Execute" }),
    ).toBeInTheDocument();
  },
};
