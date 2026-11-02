import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { PullRequests } from ".";
import { STORY_NOW } from "../stories/examples";
import { pullsDoc } from "../stories/pulls";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Details/Pull Requests",
  component: PullRequests,
  tags: ["autodocs"],
  args: {
    doc: pullsDoc,
    trackerKey: "KF-301",
    searchable: true,
    onRefresh: fn(),
    now: STORY_NOW,
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals} width={760}>
      <PullRequests {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof PullRequests>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Linked pull requests, newest first: an open one with its checks,
 * conflicts, threads and review, a draft, a merged one and a closed one.
 */
export const Linked: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("listitem")).toHaveLength(4);
    await expect(canvas.getByText("✓ CI green")).toHaveClass("ok");
    await expect(canvas.getByText("1 unanswered thread")).toHaveClass("warn");
    await expect(canvas.getByText("✗ merge conflicts")).toHaveClass("bad");
    await expect(
      canvas.getByRole("link", { name: /v2 endpoint/ }),
    ).toHaveAttribute("target", "_blank");
    await userEvent.click(
      canvas.getByRole("button", { name: "Check the pull requests again" }),
    );
    await expect(args.onRefresh).toHaveBeenCalled();
  },
};

/** Found by the tracker key, none linked yet, from the Mac's copy. */
export const FoundByKey: Story = {
  name: "Found By Key",
  args: { doc: { ...pullsDoc, linked: false }, copy: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        /found by searching for KF-301; none linked to this task yet/i,
      ),
    ).toBeInTheDocument();
  },
};

/** None found. */
export const NoneFound: Story = {
  name: "None Found",
  args: { doc: { prs: [], fetchedAt: STORY_NOW.toISOString() } },
};

/** While checking. */
export const Looking: Story = {
  args: { doc: null, busy: true },
};

/** Nothing to search by. */
export const NothingToSearch: Story = {
  name: "Nothing To Search",
  args: { doc: null, searchable: false },
};
