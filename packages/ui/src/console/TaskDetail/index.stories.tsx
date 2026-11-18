import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { detailsItem, detailsPage } from "../../sidebar/stories/details";
import { STORY_NOW } from "../../sidebar/stories/examples";
import { pullsDoc } from "../../sidebar/stories/pulls";
import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { TaskDetail } from ".";

const meta = {
  title: "Components/Console/Task Detail",
  tags: ["autodocs"],
  component: TaskDetail,
  args: {
    task: detailsItem,
    systemName: "Kestrel Freight",
    details: { state: "ready", page: detailsPage },
    pulls: pullsDoc,
    moves: ["tomorrow", "backlog"],
    now: STORY_NOW,
    onDone: fn(),
    onMove: fn(),
    onStatus: fn(),
    onExecute: fn(),
    onPlan: fn(),
    onCopyReference: fn(),
  },
  render: (args) => (
    <ConsoleComponentFrame width={900}>
      <TaskDetail {...args} />
    </ConsoleComponentFrame>
  ),
} satisfies Meta<typeof TaskDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A wide pane: actions at the top right, then the ticket, pull requests and the page. */
export const Wide: Story = {};

/** A narrow pane: the actions wrap under the title. */
export const Narrow: Story = {
  render: (args) => (
    <ConsoleComponentFrame width={402}>
      <TaskDetail {...args} />
    </ConsoleComponentFrame>
  ),
};

/** No page yet: Plan is offered, and the page section says so. */
export const NoPage: Story = {
  name: "No Page",
  args: {
    task: { ...detailsItem, details: undefined },
    details: { state: "none" },
    pulls: null,
  },
};

/** A Commander request still open: its line shows, and Status, Execute and Plan are off. */
export const RequestOpen: Story = {
  name: "Request Open",
  args: {
    request: "Commander asked the owner where this stands · 2 min ago",
    commanderBusy: "A Commander request for this item is still open",
  },
};

/** Each action reports the task; Move offers the other ranges. */
export const Actions: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const group = within(canvas.getByRole("group", { name: "Task actions" }));
    await userEvent.click(
      group.getByRole("button", { name: "Copy reference" }),
    );
    await expect(args.onCopyReference).toHaveBeenCalledWith(args.task);
    await userEvent.click(group.getByRole("button", { name: "Status" }));
    await expect(args.onStatus).toHaveBeenCalledWith(args.task);
    await userEvent.click(group.getByRole("button", { name: /^Move for/ }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Backlog" }));
    await expect(args.onMove).toHaveBeenCalledWith(args.task, "backlog");
  },
};
