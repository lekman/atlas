import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { ConsoleMenu } from ".";

const pick = fn();

const meta = {
  title: "Components/Console/Console Menu",
  tags: ["autodocs"],
  component: ConsoleMenu,
  args: {
    label: "Actions",
    name: "Cut the depots over to the new scanner API",
    items: [
      { label: "Copy reference", onSelect: pick },
      { label: "Done", divider: true, onSelect: pick },
      {
        label: "Status",
        divider: true,
        disabled: true,
        hint: "A Commander request is still open",
      },
    ],
    footer: "A Commander request for this item is still open.",
  },
  render: (args) => (
    <ConsoleComponentFrame>
      <div style={{ height: 260, display: "flex", justifyContent: "flex-end" }}>
        <div>
          <ConsoleMenu {...args} />
        </div>
      </div>
    </ConsoleComponentFrame>
  ),
} satisfies Meta<typeof ConsoleMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A task's actions, one off while a request is open. */
export const Actions: Story = {};

/** A filter, with tickable entries. */
export const Filter: Story = {
  args: {
    label: "Filter",
    name: "the task list",
    footer: undefined,
    items: [
      { label: "Show done (3)", checked: false },
      { label: "Show approved and merged (12)", checked: true },
      { label: "Collapse to systems", divider: true },
      { label: "Expand all" },
    ],
  },
};

/** Arrow keys move between entries, skipping the one that is off; Escape closes and returns focus. */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /^Actions for/ });
    await userEvent.click(button);
    await expect(
      canvas.getByRole("menuitem", { name: "Copy reference" }),
    ).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByRole("menuitem", { name: "Done" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(
      canvas.getByRole("menuitem", { name: "Copy reference" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("menu")).toBeNull();
    await expect(button).toHaveFocus();
  },
};
