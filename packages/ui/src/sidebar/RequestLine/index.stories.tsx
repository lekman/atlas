import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { RequestLine } from ".";
import { STORY_NOW } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const at = (minutes: number) =>
  new Date(STORY_NOW.getTime() - minutes * 60000).toISOString();

const meta = {
  title: "Sidebar/Commander/Request Line",
  component: RequestLine,
  tags: ["autodocs"],
  args: {
    now: STORY_NOW,
    request: {
      id: "dash-1",
      ref: "db:1",
      action: "execute",
      state: "dispatched",
      summary: "Sent to the Kestrel session",
      worker: "Kestrel",
      requestedAt: at(12),
      updatedAt: at(4),
    },
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <RequestLine {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof RequestLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** On its way: grey, with what Commander said and when. */
export const Dispatched: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("execute · dispatched")).toHaveClass(
      "neutral",
    );
    await expect(canvas.getByText("4m ago")).toBeInTheDocument();
  },
};

/** Answered: green. */
export const Answered: Story = {
  args: {
    request: {
      id: "dash-2",
      ref: "db:1",
      action: "status",
      state: "answered",
      summary: "Waiting on the depot leads; cut-over still Saturday",
      requestedAt: at(30),
      updatedAt: at(2),
    },
  },
};

/** Failed: red, with the reason. */
export const Failed: Story = {
  args: {
    request: {
      id: "dash-3",
      ref: "db:1",
      action: "plan",
      state: "failed",
      summary:
        "Not sent: allow the Cloudflare connector for this page, then try again.",
      requestedAt: at(1),
      updatedAt: at(1),
    },
  },
};

/** From the phone, waiting in the inbox. */
export const Queued: Story = {
  args: {
    request: {
      id: "dash-4",
      ref: "db:1",
      action: "done",
      state: "queued",
      via: "inbox",
      summary:
        "Marking it done from the phone; the Mac mini applies it within a minute.",
      requestedAt: at(0.5),
      updatedAt: at(0.5),
    },
  },
};
