import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Panel } from ".";
import { Note } from "../Note";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Frame/Panel",
  component: Panel,
  tags: ["autodocs"],
  args: {
    title: "Meridian Bank · GitHub, open issues",
    sub: "9 open",
    fresh: "Read 2 min ago",
    children: (
      <ul style={{ margin: 0, padding: "8px 16px 0 32px" }}>
        <li>Rotate the deploy key on the staging runner</li>
        <li>Pin the base image digest</li>
      </ul>
    ),
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <Panel {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A titled section with a count and a freshness line. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("region", { name: /meridian bank/i }),
    ).toBeInTheDocument();
  },
};

/** Before the first answer: grey bars, marked busy. */
export const Loading: Story = {
  args: { loading: 3, sub: undefined, fresh: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      /loading meridian bank/i,
    );
  },
};

/** The stored copy, with the reason the live read failed above it. */
export const WithNote: Story = {
  name: "With Note",
  args: {
    notes: (
      <Note tone="warn">
        GitHub didn't answer. Showing the last data received; it tries again on
        the next refresh.
      </Note>
    ),
    fresh: "Stored copy from 08:15",
  },
};

/** Nothing to show, which the panel says rather than going blank. */
export const Empty: Story = {
  args: {
    sub: "0 open",
    children: <div className="blank">No open issues.</div>,
  },
};
