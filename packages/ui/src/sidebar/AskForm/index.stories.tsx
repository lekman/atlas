import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AskForm } from ".";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";
import { plainAsk, supportAsk } from "../stories/asks";
import { askOptions, YES_NO_OPTIONS } from "../waiting/model";

const meta = {
  title: "Sidebar/Details/Answer an Ask",
  component: AskForm,
  tags: ["autodocs"],
  args: {
    ask: supportAsk.ask!,
    from: "Halcyon",
    options: askOptions(supportAsk),
    onSend: fn(),
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <div style={{ padding: "0 16px" }}>
        <AskForm {...args} />
      </div>
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof AskForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The asker's options, recommended first, then Other. Choosing one sends it with an optional note. */
export const WithOptions: Story = {
  name: "With Options",
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const send = canvas.getByRole("button", { name: "Send to Halcyon" });
    await expect(send).toBeDisabled();
    await userEvent.click(
      canvas.getByRole("radio", {
        name: /Hold until the pilot sends \(Recommended\)/,
      }),
    );
    await userEvent.type(canvas.getByRole("textbox"), "Revisit in December");
    await userEvent.click(send);
    await expect(args.onSend).toHaveBeenCalledWith({
      choice: "Hold until the pilot sends",
      text: "Revisit in December",
    });
  },
};

/** Other: the answer in your own words. */
export const Other: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: /Other/ }));
    const send = canvas.getByRole("button", { name: "Send to Halcyon" });
    await expect(send).toBeDisabled();
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Your answer" }),
      "They use TOPdesk, with a REST API",
    );
    await userEvent.click(send);
    await expect(args.onSend).toHaveBeenCalledWith({
      text: "They use TOPdesk, with a REST API",
    });
  },
};

/** An ask without options takes a written answer only. */
export const NoOptions: Story = {
  name: "No Options",
  args: { ask: plainAsk.ask!, from: "Commander", options: [] },
};

/** After sending: what Commander did with it. */
export const Sent: Story = {
  args: {
    status: { tone: "warn", text: "Sent; Commander hands it to Halcyon." },
  },
};

/** The dark theme, which the accessibility check also runs on. */
export const Dark: Story = {
  globals: { lighting: "night" },
  args: { status: { tone: "ok", text: "Halcyon has your answer." } },
};

/**
 * A closed question without options of its own: yes or no, once or for all
 * future requests, then Other. "For all future requests" is sent as always.
 */
export const YesOrNo: Story = {
  name: "Yes or No",
  args: {
    ask: "Restart the Dashboard waiter?",
    from: "Commander",
    options: [...YES_NO_OPTIONS],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("radio", { name: /Yes, and for all future requests/ }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Send to Commander" }),
    );
    await expect(args.onSend).toHaveBeenCalledWith({
      choice: "Yes, and for all future requests",
      always: true,
    });
  },
};
