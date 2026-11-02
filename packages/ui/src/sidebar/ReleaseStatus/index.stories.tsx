import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { ReleaseStatus } from ".";
import { STORY_NOW } from "../stories/examples";
import {
  releaseDrifted,
  releaseGapOnly,
  releaseSynced,
} from "../stories/release";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Trackers/Release Status",
  component: ReleaseStatus,
  tags: ["autodocs"],
  args: { doc: releaseDrifted, live: true, error: null, now: STORY_NOW },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <ReleaseStatus {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof ReleaseStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Four repositories drifted: two environments behind, a failed production
 * deploy, development deploying, and one without a release branch. Red,
 * because something failed.
 */
export const Drifted: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole("table", { name: /drifted repositories/i });
    await expect(within(table).getAllByRole("row")).toHaveLength(5);
    await expect(
      canvas.getByText("Production: last deploy failed"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("no release branch")).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: "drifted" })).toHaveClass(
      "bad",
    );
  },
};

/** Gaps but nothing failed: yellow. */
export const GapsOnly: Story = {
  name: "Gaps Only",
  args: { doc: releaseGapOnly },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "drifted" }),
    ).toHaveClass("yellow");
  },
};

/** Everything on its head: one green line. */
export const AllSynced: Story = {
  name: "All Synced",
  args: { doc: releaseSynced },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("all 14 synced"),
    ).toBeInTheDocument();
  },
};

/** On the phone: the saved result, with its age. */
export const SavedResult: Story = {
  name: "Saved Result",
  args: { live: false },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/saved result, 12m ago/),
    ).toBeInTheDocument();
  },
};

/** The last live check failed, so the saved result shows with a red note. */
export const CheckFailed: Story = {
  name: "Check Failed",
  args: {
    live: false,
    error: { code: "tool_error", message: "gh: rate limited" },
  },
};

/** Before any result, on a device that cannot run the check. */
export const Elsewhere: Story = {
  args: { doc: null, error: { code: "server_not_connected" } },
};

/** Before the first result. */
export const Checking: Story = {
  args: { doc: null, error: null },
};
