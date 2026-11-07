import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DetailsView } from ".";
import { ItemActions } from "../ItemActions";
import { RequestLine } from "../RequestLine";
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

/**
 * Without `onClose` the details are the whole page, as in a VS Code editor
 * tab: the main landmark, the title as its first heading, the tab's full
 * width, and no Back button. Escape leaves it as it is.
 */
export const EditorTab: Story = {
  name: "Editor Tab",
  args: { onClose: undefined },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals} width={1280}>
      <DetailsView {...args} />
    </SidebarStoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const main = canvas.getByRole("main", { name: detailsItem.title });
    await expect(
      within(main).getByRole("heading", { level: 1, name: detailsItem.title }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Back to Atlas" }),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect(main).toBeVisible();
  },
};

/** With its actions under the title, and the newest Commander request. */
export const WithActions: Story = {
  name: "With Actions",
  args: {
    actions: (
      <>
        <ItemActions
          groups={[
            [
              {
                icon: "play",
                label: "Execute: dispatch to the owner",
                primary: true,
                onSelect: fn(),
              },
              {
                icon: "pulse",
                label: "Status: ask the owner where this stands",
                onSelect: fn(),
              },
            ],
            [
              { icon: "check", label: "Done", onSelect: fn() },
              { icon: "right", label: "Move to tomorrow", onSelect: fn() },
              { icon: "doorout", label: "Move to the backlog", onSelect: fn() },
            ],
          ]}
        />
        <div className="dstatus">
          <RequestLine
            now={STORY_NOW}
            request={{
              id: "dash-1",
              ref: "db:42",
              action: "execute",
              state: "dispatched",
              summary: "Sent to the Kestrel session",
              requestedAt: STORY_NOW.toISOString(),
              updatedAt: STORY_NOW.toISOString(),
            }}
          />
        </div>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("group", { name: "Item actions" }),
    ).toBeInTheDocument();
  },
};
