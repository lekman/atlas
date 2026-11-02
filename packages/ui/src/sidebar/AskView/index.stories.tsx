import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AskView } from ".";
import { AskForm } from "../AskForm";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";
import { supportAsk } from "../stories/asks";
import { askOptions } from "../waiting/model";

const meta = {
  title: "Sidebar/Details/Ask From Commander",
  component: AskView,
  parameters: { layout: "fullscreen" },
  args: {
    item: supportAsk,
    clientName: "Halcyon Labs",
    onClose: fn(),
    children: null,
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <div style={{ position: "relative", minHeight: 640 }}>
        <AskView {...args}>
          <AskForm
            ask={supportAsk.ask!}
            from="Halcyon"
            options={askOptions(supportAsk)}
            onSend={fn()}
          />
        </AskView>
      </div>
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof AskView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A Commander ask with no task: who asks, since when, and the answer form. Back closes it. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("dialog", { name: "Halcyon asks" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to Atlas" }),
    );
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const Dark: Story = { globals: { lighting: "night" } };
