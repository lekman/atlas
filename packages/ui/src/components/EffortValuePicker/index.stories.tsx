import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { EffortValuePicker } from ".";
import { EveryWorld } from "../../stories/EveryWorld";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

const meta = {
  title: "Components/Effort and Value Picker",
  tags: ["autodocs"],
  component: EffortValuePicker,
  args: { onChange: fn() },
  render: (args, { globals }) => (
    <WorldFrame world={storyWorld(globals)} lighting={storyLighting(globals)}>
      <EffortValuePicker {...args} />
    </WorldFrame>
  ),
} satisfies Meta<typeof EffortValuePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An imported task with no size yet: nothing chosen, and a prompt in place of a priority. */
export const Unsized: Story = {};

/** Medium effort for a value of 8 works out as high priority, with the sum shown. */
export const HighPriority: Story = {
  name: "High Priority",
  args: { initialEffort: "M", initialValue: 8 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(/High priority/);
  },
};

/** Choosing XL and 3 reports each pick and shows "Not worth it". */
export const NotWorthIt: Story = {
  name: "Not Worth It",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "XL" }));
    await expect(args.onChange).toHaveBeenLastCalledWith({
      effort: "XL",
      value: undefined,
    });
    await userEvent.click(canvas.getByRole("radio", { name: "3" }));
    await expect(args.onChange).toHaveBeenLastCalledWith({
      effort: "XL",
      value: 3,
    });
    const status = canvas.getByRole("status");
    await expect(status).toHaveTextContent(/Not worth it/);
    await expect(status).toHaveTextContent(/Low priority/);
  },
};

/** A sized task in each world's palette, the warning included. */
export const InEveryWorld: Story = {
  name: "In Every World",
  args: { initialEffort: "XL", initialValue: 2 },
  render: (args) => (
    <EveryWorld>{() => <EffortValuePicker {...args} />}</EveryWorld>
  ),
};
