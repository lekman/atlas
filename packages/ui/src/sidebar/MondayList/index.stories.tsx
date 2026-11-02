import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { MondayList } from ".";
import { RequestLine } from "../RequestLine";
import { RowButton } from "../RowButton";
import { STORY_NOW } from "../stories/examples";
import { mondayExample } from "../stories/monday";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Trackers/Monday List",
  component: MondayList,
  tags: ["autodocs"],
  args: {
    title: "Kestrel Freight · Monday, assigned to me",
    page: mondayExample,
    error: null,
    updatedAt: new Date(STORY_NOW.getTime() - 3 * 60000),
    now: STORY_NOW,
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <MondayList {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof MondayList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Grouped by status, Stuck first in red and Working on it in amber, then
 * the board's own statuses. Done items never show.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("6 not done")).toBeInTheDocument();
    await expect(canvas.queryByText("Old pallet labels")).toBeNull();
    const links = canvas.getAllByRole("link");
    await expect(links[0]).toHaveTextContent(/scanner api/i);
    await expect(links[0]).toHaveAttribute("target", "_blank");
    await expect(canvas.getByText("KF-301")).toBeInTheDocument();
  },
};

/** More than a page on the board. */
export const FirstPageOnly: Story = {
  name: "First Page Only",
  args: { page: { ...mondayExample, more: true } },
};

/** Nothing assigned that isn't done. */
export const Empty: Story = {
  args: { page: { items: [], more: false } },
};

/** The connector isn't allowed for this page. */
export const NotAllowed: Story = {
  name: "Not Allowed",
  args: {
    page: null,
    error: {
      tone: "err",
      text: "monday.com is turned off for this page. Allow it from the page's Permissions menu.",
    },
  },
};

/** Before the first answer. */
export const Loading: Story = {
  args: { page: null },
};

/**
 * Each row's button: to its task in the worklist when it has one, or Plan
 * with Commander when it hasn't; a plan in progress shows under the row
 * and waits.
 */
export const WithButtons: Story = {
  name: "With Buttons",
  args: {
    rowAction: (item) =>
      item.key === "KF-301" ? (
        <RowButton
          icon="arrow"
          label={`Open the task for ${item.key} in the worklist`}
          onClick={() => undefined}
        />
      ) : (
        <RowButton
          icon="send"
          label={
            item.key === "KF-296"
              ? `Commander is planning ${item.key}`
              : `Plan ${item.key} with Commander`
          }
          disabled={item.key === "KF-296"}
          onClick={() => undefined}
        />
      ),
    rowStatus: (item) =>
      item.key === "KF-296" ? (
        <RequestLine
          now={STORY_NOW}
          request={{
            id: "dash-9",
            ref: "monday:KF-296",
            action: "plan",
            state: "asked",
            summary: "Asked the Kestrel session for a plan",
            requestedAt: STORY_NOW.toISOString(),
            updatedAt: STORY_NOW.toISOString(),
          }}
        />
      ) : null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", {
        name: "Open the task for KF-301 in the worklist",
      }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Commander is planning KF-296" }),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(canvas.getByText("plan · asked")).toBeInTheDocument();
  },
};
