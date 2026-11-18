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
 * Moving a task: the Move control opens the sheet, Tomorrow moves it, and
 * it leaves Today's list. The sheet is a dialog, so focus starts on the
 * first choice.
 */
export const MoveATask: Story = {
  name: "Move a Task",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = "Confirm the release notes with the depot leads";
    await userEvent.click(
      canvas.getByRole("button", { name: `Move ${title}` }),
    );
    const sheet = within(
      canvas.getByRole("dialog", { name: `Move “${title}”` }),
    );
    await expect(sheet.getByRole("button", { name: "Tomorrow" })).toHaveFocus();
    await userEvent.click(sheet.getByRole("button", { name: "Tomorrow" }));
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: new RegExp(title) }),
    ).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Tomorrow" }));
    await expect(
      canvas.getByRole("button", { name: `Move ${title}` }),
    ).toBeInTheDocument();
  },
};

/** Moving while the relay is down: the sheet says the move waits for the Mac mini. */
export const MoveWhileQueued: Story = {
  name: "Move While Queued",
  args: { relay: { kind: "stored" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getAllByRole("button", { name: /^Move (?!the menu)/ })[0]!,
    );
    await expect(canvas.getByRole("dialog")).toHaveTextContent(
      "The move is queued",
    );
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("dialog")).toBeNull();
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
