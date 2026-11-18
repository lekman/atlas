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
    const tasks = within(canvas.getByRole("list", { name: "Tasks" }));
    await userEvent.click(tasks.getAllByRole("button")[0]!);
    await expect(
      canvas.getByRole("article", { name: "Task" }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(
      canvas.getByRole("list", { name: "Tasks" }),
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
  args: { width: 890, height: 626, selectedId: undefined },
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
