import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DetailsView } from ".";
import { detailsItem, detailsPage } from "../stories/details";
import { STORY_NOW } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Details/Details View",
  component: DetailsView,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    item: detailsItem,
    clientName: "Kestrel Freight",
    details: { state: "ready", page: detailsPage },
    githubOrg: "kestrel-freight",
    mondayPrefix: "KF",
    weekEnd: "2026-03-19",
    now: STORY_NOW,
    onClose: fn(),
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals} width={760}>
      <DetailsView {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof DetailsView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The page from the vault under its badges: status from the live sources,
 * the Monday item, the quadrant with value and effort, a near due date in
 * red, and the repositories, a bare name taking the client's organisation.
 */
export const Page: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const dialog = canvas.getByRole("dialog", { name: detailsItem.title });
    await expect(
      canvas.getByRole("button", { name: "Back to Atlas" }),
    ).toHaveFocus();
    await expect(within(dialog).getByText("IN PROGRESS")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: /KF-301/ })).toHaveAttribute(
      "href",
      "https://example.monday.com/boards/1/pulses/301",
    );
    await expect(
      canvas.getByRole("link", { name: /depot-api/ }),
    ).toHaveAttribute("href", "https://github.com/kestrel-freight/depot-api");
    await expect(
      canvas.getByRole("heading", { name: "Test plan" }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("table")).toBeInTheDocument();
    await expect(
      canvas.getByRole("link", { name: "vendor notes" }),
    ).toHaveAttribute("target", "_blank");
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).toHaveBeenCalled();
  },
};

/**
 * Hostile text stays text: a script tag, a javascript: link and an
 * Obsidian link (which leads nowhere in the sidebar) are not links, and
 * nothing in the note is ever set as HTML.
 */
export const HostileText: Story = {
  name: "Hostile Text",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector(".md script")).toBeNull();
    await expect(canvas.getByText(/<script>alert/)).toBeInTheDocument();
    await expect(
      canvas.queryByRole("link", { name: "a script link" }),
    ).toBeNull();
    await expect(
      canvas.queryByRole("link", { name: "an Obsidian link" }),
    ).toBeNull();
    await expect(canvas.getByText(/a script link/)).toBeInTheDocument();
  },
};

/** The phone: a copy, with when it was made and how old the page is. */
export const FromCopy: Story = {
  name: "From Copy",
  args: {
    details: {
      state: "ready",
      page: detailsPage,
      copiedAt: new Date(STORY_NOW.getTime() - 30 * 60000).toISOString(),
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/^Copy from Thu 12 Mar 09:10/),
    ).toBeInTheDocument();
  },
};

/** No page yet: the badges, and what Plan would do. */
export const NoPage: Story = {
  name: "No Page",
  args: {
    item: { ...detailsItem, details: undefined, flags: [] },
    details: { state: "none" },
  },
};

/** A page this device can't read and has no copy of. */
export const NotHere: Story = {
  name: "Not Here",
  args: { details: { state: "missing" } },
};

/** While the page loads. */
export const Loading: Story = {
  args: { details: { state: "loading" } },
};
