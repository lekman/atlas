import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ActionMenu } from ".";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Frame/Action Menu",
  component: ActionMenu,
  tags: ["autodocs"],
  args: {
    what: "the worklist",
    actions: [
      { label: "Show done (3)", onSelect: fn() },
      {
        label: "Collapse to clients",
        onSelect: fn(),
        hint: "Each client closed",
      },
      { label: "Trim today to one day (0)", disabled: true },
    ],
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ActionMenu {...args} />
      </div>
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof ActionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens on the first action it can run; a disabled one is skipped and does nothing. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", {
      name: "Actions for the worklist",
    });
    await userEvent.click(button);
    await expect(
      canvas.getByRole("menuitem", { name: "Show done (3)" }),
    ).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(
      canvas.getByRole("menuitem", { name: "Collapse to clients" }),
    ).toHaveFocus();
    await userEvent.click(
      canvas.getByRole("menuitem", { name: /trim today/i }),
    );
    await expect(canvas.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(button).toHaveFocus();
    await userEvent.click(button);
    await userEvent.click(
      canvas.getByRole("menuitem", { name: "Show done (3)" }),
    );
    await expect(args.actions[0]!.onSelect).toHaveBeenCalled();
  },
};

/** A task's menu: Copy reference with its icon, then groups divided. */
export const ItemMenu: Story = {
  name: "Item Menu",
  args: {
    what: "Cut the depots over",
    actions: [
      { label: "Copy reference", icon: "clip", onSelect: fn() },
      { label: "Done", divider: true, onSelect: fn() },
      { label: "Move to Tomorrow", onSelect: fn() },
      { label: "Move to Backlog", onSelect: fn() },
      { label: "Status", divider: true, disabled: true, onSelect: fn() },
      { label: "Execute", disabled: true, onSelect: fn() },
    ],
    footer: "A Commander request for this item is still open.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /actions for/i }));
    await expect(
      canvas.getByRole("menuitem", { name: "Copy reference" }),
    ).toHaveFocus();
    await expect(canvas.getByText(/still open/)).toBeInTheDocument();
  },
};
