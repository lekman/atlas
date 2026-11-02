import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AssessForm } from ".";
import { detailsItem } from "../stories/details";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Planning/Assess Form",
  component: AssessForm,
  tags: ["autodocs"],
  args: { item: detailsItem, onSave: fn(), onCancel: fn(), canSave: true },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <AssessForm {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof AssessForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Only what changed is saved: here, the effort and the due date taken away. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "Effort" }),
      "L",
    );
    await userEvent.click(canvas.getByRole("button", { name: "No due date" }));
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onSave).toHaveBeenCalledWith({ effort: "L", due: null });
  },
};

/** Saving with nothing changed just closes. */
export const NothingChanged: Story = {
  name: "Nothing Changed",
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Save" }),
    );
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(args.onCancel).toHaveBeenCalled();
  },
};

/** Without the local server: the form says why, and Save waits. */
export const CannotSave: Story = {
  name: "Cannot Save",
  args: { canSave: false },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Save" }),
    ).toBeDisabled();
  },
};
