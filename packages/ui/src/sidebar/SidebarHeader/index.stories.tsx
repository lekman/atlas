import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { SidebarHeader } from ".";
import { STORY_NOW } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Frame/Header",
  component: SidebarHeader,
  tags: ["autodocs"],
  args: {
    now: STORY_NOW,
    sync: { liveAt: STORY_NOW.getTime() - 30000, syncedAt: null },
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <SidebarHeader {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof SidebarHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open in the desktop app on the Mac: the worklist is read live. */
export const Live: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Live")).toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: /Thursday 12 March/ }),
    ).toBeInTheDocument();
  },
};

/** On the phone: a stored copy, with the time it was synced today. */
export const StoredCopy: Story = {
  name: "Stored Copy",
  args: { sync: { liveAt: null, syncedAt: "2026-03-12T08:15:00" } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Synced 08:15"),
    ).toBeInTheDocument();
  },
};

/** A copy from an earlier day names the day. */
export const StoredCopyFromYesterday: Story = {
  name: "Stored Copy From Yesterday",
  args: { sync: { liveAt: null, syncedAt: "2026-03-11T17:02:00" } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Synced Wed 11 Mar 17:02"),
    ).toBeInTheDocument();
  },
};

/** Nothing stored yet, on a device that has never seen the Mac's data. */
export const NotSyncedYet: Story = {
  name: "Not Synced Yet",
  args: { sync: { liveAt: null, syncedAt: null } },
};

/** The last sync on the Mac failed; the reason is the tooltip. */
export const SyncFailed: Story = {
  name: "Sync Failed",
  args: {
    sync: {
      liveAt: null,
      syncedAt: "2026-03-12T08:15:00",
      error: "events: no answer",
    },
  },
};
