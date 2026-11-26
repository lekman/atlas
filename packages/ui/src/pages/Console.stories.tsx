import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import "../console/fonts";
import { ConsoleStoryFrame } from "../console/stories/ConsoleStoryFrame";

/**
 * The full-page console in the four places it opens, each at its real size
 * in CSS pixels. Only the shell is built: the top bar, the rail, and list
 * and detail. Missions shows invented tasks so list and detail can be tried.
 */
const meta = {
  title: "Pages/Console",
  component: ConsoleStoryFrame,
  parameters: { layout: "fullscreen" },
  args: { width: 420, height: 820 },
} satisfies Meta<typeof ConsoleStoryFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * In the sidebar beside an artifact on the desktop app. One pane: the rail
 * starts on the right for the thumb, an item replaces the list, and Back
 * returns to it. The swap button moves the rail to the left edge.
 */
export const InTheSidebar: Story = {
  name: "In the Sidebar",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvasElement.querySelector(".atlas-console")!;
    await expect(frame.getAttribute("data-layout")).toBe("single");
    await expect(frame.getAttribute("data-rail")).toBe("right");
    const first = canvas.getByRole("button", {
      name: /^In progress: Cut the depots over to the new scanner API/,
    });
    await userEvent.click(first);
    await expect(
      canvas.getByRole("heading", {
        name: "Cut the depots over to the new scanner API",
      }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(
      canvas.getByRole("group", { name: "Range" }),
    ).toBeInTheDocument();
    // The swap button moves the menu on: bottom, then left, then back right.
    await userEvent.click(
      canvas.getByRole("button", { name: "Move the menu to the bottom edge" }),
    );
    await expect(frame.getAttribute("data-rail")).toBe("bottom");
    await userEvent.click(
      canvas.getByRole("button", { name: "Move the menu to the left edge" }),
    );
    await expect(frame.getAttribute("data-rail")).toBe("left");
    await userEvent.click(
      canvas.getByRole("button", { name: "Move the menu to the right edge" }),
    );
  },
};

/** A narrow sidebar: the fleet switcher uses short names so the bar still fits. */
export const InANarrowSidebar: Story = {
  name: "In a Narrow Sidebar",
  args: { width: 360, height: 720 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: /^WRK\W+Work$/ }),
    ).toBeInTheDocument();
  },
};

/** A folding phone held closed, 466 by 678: the same single pane as the sidebar. */
export const FoldingPhoneClosed: Story = {
  name: "Folding Phone Closed",
  args: { width: 466, height: 678 },
};

/**
 * A folding phone held open, 890 by 626. The list and the item meet at the
 * fold, x = 445, with the rail on the left; nothing crosses the crease.
 */
export const FoldingPhoneOpen: Story = {
  name: "Folding Phone Open",
  args: { width: 890, height: 626 },
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector(".atlas-console")!;
    await expect(frame.getAttribute("data-layout")).toBe("split");
    await expect(frame.getAttribute("data-rail")).toBe("left");
    const left = frame.getBoundingClientRect().left;
    const list = frame
      .querySelector(".console-pane-list")!
      .getBoundingClientRect();
    await expect(Math.round(list.right - left)).toBe(445);
  },
};

/** Open, with the rail moved to the right: the list is now the whole left half. */
export const FoldingPhoneOpenRailRight: Story = {
  name: "Folding Phone Open, Rail Right",
  args: { width: 890, height: 626 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvasElement.querySelector(".atlas-console")!;
    await userEvent.click(
      canvas.getByRole("button", { name: "Move the menu to the right edge" }),
    );
    const left = frame.getBoundingClientRect().left;
    const list = frame
      .querySelector(".console-pane-list")!
      .getBoundingClientRect();
    await expect(Math.round(list.right - left)).toBe(445);
    // With the menu at the bottom the panes still meet at the fold.
    await userEvent.click(
      canvas.getByRole("button", { name: "Move the menu to the bottom edge" }),
    );
    await expect(frame.getAttribute("data-rail")).toBe("bottom");
    const below = frame
      .querySelector(".console-pane-list")!
      .getBoundingClientRect();
    await expect(Math.round(below.right - left)).toBe(445);
    await userEvent.click(
      canvas.getByRole("button", { name: "Move the menu to the left edge" }),
    );
  },
};

/** A laptop, full page, 1440 by 900: the list keeps a reading width and the item takes the rest. */
export const Laptop: Story = {
  args: { width: 1440, height: 900 },
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector(".atlas-console")!;
    await expect(frame.getAttribute("data-layout")).toBe("wide");
  },
};

/** The open phone with a task selected: the list stays on the left of the fold, the task on the right. */
export const FoldingPhoneOpenWithATask: Story = {
  name: "Folding Phone Open, With a Task",
  args: { width: 890, height: 626, selectedKey: "db:1" },
};

/** The quadrant grid on a laptop: four cells side by side, ungraded tasks under them. */
export const MissionsGrid: Story = {
  name: "Missions Grid",
  args: { width: 1440, height: 900, view: "grid", range: "backlog" },
};

/**
 * A task's Actions menu: Copy reference, Done, the two other ranges,
 * Status and Execute. Move to Tomorrow takes it out of Today's list.
 */
export const TaskActions: Story = {
  name: "Task Actions",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = "Confirm the release notes with the depot leads";
    await userEvent.click(
      canvas.getByRole("button", { name: `Actions for ${title}` }),
    );
    const menu = within(
      canvas.getByRole("menu", { name: `Actions for ${title}` }),
    );
    await expect(
      menu.getByRole("menuitem", { name: "Copy reference" }),
    ).toHaveFocus();
    await expect(
      menu.getByRole("menuitem", { name: "Execute" }),
    ).toBeInTheDocument();
    await userEvent.click(
      menu.getByRole("menuitem", { name: "Move to Tomorrow" }),
    );
    await expect(canvas.queryByRole("menu")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: `Actions for ${title}` }),
    ).toBeNull();
  },
};

/** Search and the filter menu: words narrow the list; Show done brings done tasks back. */
export const SearchAndFilter: Story = {
  name: "Search and Filter",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Search tasks" }),
      "scanner",
    );
    await expect(
      canvas.getByRole("button", { name: /^In progress: Cut the depots over/ }),
    ).toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: /^Queued: Route planner timeout/ }),
    ).toBeNull();
    await userEvent.clear(
      canvas.getByRole("searchbox", { name: "Search tasks" }),
    );
    await expect(
      canvas.queryByText(/Archive last year's delivery notes/),
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "Filter for the task list" }),
    );
    await userEvent.click(
      canvas.getByRole("menuitemcheckbox", { name: /^Show done/ }),
    );
    await expect(
      canvas.getByText(/Archive last year's delivery notes/),
    ).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Filter for the task list" }),
    );
    await userEvent.click(
      canvas.getByRole("menuitem", { name: "Collapse to systems" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Kestrel Freight" }),
    ).toHaveAttribute("aria-expanded", "false");
  },
};

/** The relay down: the Actions menu says moves wait for the Mac mini. */
export const ActionsWhileQueued: Story = {
  name: "Actions While Queued",
  args: { relay: { kind: "stored" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getAllByRole("button", { name: /^Actions for / })[0]!,
    );
    await expect(canvas.getByRole("menu")).toHaveTextContent(
      "moves wait for the Mac mini",
    );
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("menu")).toBeNull();
  },
};

/**
 * The task detail on a laptop: the actions at the top right, then the
 * facts with the ticket among them, the pull requests and the details.
 */
export const TaskDetailOnALaptop: Story = {
  name: "Task Detail on a Laptop",
  args: { width: 1440, height: 900, selectedKey: "db:1" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actions = within(canvas.getByRole("group", { name: "Task actions" }));
    await expect(
      actions.getByRole("button", { name: "Copy reference" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Ticket")).toBeInTheDocument();
    await expect(
      canvas.getByRole("region", { name: "Pull requests" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("region", { name: "Details" }),
    ).toBeInTheDocument();
    await userEvent.click(actions.getByRole("button", { name: "Status" }));
    await expect(canvas.getByText(/Asked the owner about/)).toBeInTheDocument();
  },
};

/**
 * Narrowing to one system: the scope button opens the picker with each
 * system's open tasks, picking one narrows the list and names it on the
 * button, and All systems widens it again.
 */
export const PickASystem: Story = {
  name: "Pick a System",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /^Scope: All systems/ }),
    );
    const sheet = within(
      canvas.getByRole("dialog", { name: "Show one system" }),
    );
    await expect(
      sheet.getByRole("button", { name: /^All systems/ }),
    ).toHaveFocus();
    await userEvent.click(sheet.getByRole("button", { name: /^Halcyon Labs/ }));
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(
      canvas.getByRole("button", { name: /^Scope: Halcyon Labs/ }),
    ).toBeInTheDocument();
    await expect(
      canvas.queryByRole("region", { name: "Kestrel Freight" }),
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: /^Scope: Halcyon Labs/ }),
    );
    await userEvent.click(
      within(canvas.getByRole("dialog")).getByRole("button", {
        name: /^All systems/,
      }),
    );
    await expect(
      canvas.getByRole("region", { name: "Kestrel Freight" }),
    ).toBeInTheDocument();
  },
};

/**
 * Shields on a laptop: hosts, the relay and integrations in the list, and a
 * host's figures and last 24 hours beside it. The rail counts the rows that
 * need a look.
 */
export const ShieldsOnALaptop: Story = {
  name: "Shields on a Laptop",
  args: { width: 1440, height: 900, section: "shields" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /^Needs a look: laptop/ }),
    );
    await expect(
      canvas.getByRole("heading", { name: "laptop" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("group", { name: /CPU % over the last 24 hours/ }),
    ).toBeInTheDocument();
  },
};

/** Shields in the sidebar: one pane, a row opens with a back link. */
export const ShieldsInTheSidebar: Story = {
  name: "Shields in the Sidebar",
  args: { section: "shields" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /^Alert: Calendars/ }),
    );
    await expect(
      canvas.getByText(/Asked to slow down/, { selector: "dd" }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(
      canvas.getByRole("heading", { name: "Shields" }),
    ).toBeInTheDocument();
  },
};

/** Settings opened from the rail fills the panes, and the rail marks it as current. */
export const SettingsOpen: Story = {
  name: "Settings Open",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Settings" }));
    await expect(
      canvas.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Settings" }),
    ).toHaveAttribute("aria-current", "page");
  },
};

/** The relay down to the stored copy, with actions waiting for the Mac mini. */
export const QueuedForTheMacMini: Story = {
  name: "Queued for the Mac Mini",
  args: { relay: { kind: "queued", count: 2 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Queued 2",
    );
  },
};
