import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { DetailsPlaceholder } from ".";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Details/Details Placeholder",
  component: DetailsPlaceholder,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    title: "Task not found",
    children:
      "The worklist does not have this task. This tab shows it as soon as the worklist does.",
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals} width={1100}>
      <DetailsPlaceholder {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof DetailsPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An editor tab for a task the worklist does not have, as when the task
 * was finished elsewhere. The tab keeps listening for the worklist.
 */
export const NotFound: Story = {
  name: "Not Found",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Task not found" }),
    ).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent(
      /as soon as the worklist does/,
    );
  },
};

/** An editor tab while the worklist loads. */
export const Loading: Story = {
  args: { title: "Loading the task", children: "Reading the worklist…" },
};
