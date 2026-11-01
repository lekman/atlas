import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Note } from ".";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Frame/Note",
  component: Note,
  tags: ["autodocs"],
  args: { children: "Showing the copy stored at 08:15." },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <section className="panel">
        <Note {...args} />
      </section>
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof Note>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A hint, on the hatch fill. */
export const Info: Story = {};

/** Stale or partial data: amber. */
export const Warning: Story = {
  args: {
    tone: "warn",
    children:
      "Host stats didn't answer. Showing the last data received; it tries again on the next refresh.",
  },
};

/** A failure: red, and announced to screen readers. */
export const Error: Story = {
  args: {
    tone: "err",
    children:
      "GitHub isn't connected for you. Add it in claude.ai Settings → Connectors.",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toBeInTheDocument();
  },
};

/** One the reader can dismiss. */
export const Closable: Story = {
  args: {
    onClose: fn(),
    children: "Copied: Regarding task “Renew the TLS certificates”",
  },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Dismiss" }),
    );
    await expect(args.onClose).toHaveBeenCalled();
  },
};
