import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ItemActions } from ".";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const plan = fn();
const execute = fn();
const done = fn();

const meta = {
  title: "Sidebar/Commander/Item Actions",
  component: ItemActions,
  tags: ["autodocs"],
  args: {
    groups: [
      [
        {
          icon: "send",
          label: "Plan with Commander",
          primary: true,
          onSelect: plan,
        },
        {
          icon: "play",
          label: "Execute: dispatch to the owner",
          onSelect: execute,
        },
        {
          icon: "pulse",
          label: "Status: ask the owner where this stands",
          onSelect: fn(),
        },
      ],
      [
        { icon: "check", label: "Done", onSelect: done },
        { icon: "right", label: "Move to tomorrow", onSelect: fn() },
        { icon: "doorout", label: "Move to the backlog", onSelect: fn() },
      ],
    ],
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <ItemActions {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof ItemActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A task without a page: Plan leads. Each button is named for screen readers and as its tooltip. */
export const WithoutPage: Story = {
  name: "Without Page",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Plan with Commander" }),
    );
    await expect(plan).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await expect(done).toHaveBeenCalled();
  },
};

/** A Commander request is still open: its three actions wait, and say why. */
export const RequestOpen: Story = {
  name: "Request Open",
  args: {
    groups: [
      [
        {
          icon: "play",
          label: "Execute: dispatch to the owner",
          primary: true,
          disabled: true,
          why: "a commander request for this item is still open",
          onSelect: execute,
        },
        {
          icon: "pulse",
          label: "Status: ask the owner where this stands",
          disabled: true,
          why: "a commander request for this item is still open",
          onSelect: fn(),
        },
      ],
      [{ icon: "check", label: "Done", onSelect: done }],
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /execute.*still open/i });
    await expect(button).toHaveAttribute("aria-disabled", "true");
    execute.mockClear();
    await userEvent.click(button);
    await expect(execute).not.toHaveBeenCalled();
  },
};
