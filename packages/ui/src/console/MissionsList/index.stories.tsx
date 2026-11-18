import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { exampleClients } from "../../sidebar/stories/examples";
import {
  STORY_TODAY,
  STORY_TOMORROW,
  worklistItems,
} from "../../sidebar/stories/worklist";
import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { MissionsList } from ".";

const meta = {
  title: "Components/Console/Missions List",
  tags: ["autodocs"],
  component: MissionsList,
  args: {
    items: worklistItems,
    today: STORY_TODAY,
    tomorrow: STORY_TOMORROW,
    range: "today",
    view: "list",
    scope: null,
    systemName: (key: string) =>
      exampleClients.find((client) => client.key === key)?.name ?? key,
    onRangeChange: fn(),
    onViewChange: fn(),
    onScope: fn(),
    onTriage: fn(),
    onSelect: fn(),
    onQuery: fn(),
    onFilter: fn(),
    onFold: fn(),
    actionsFor: () => [
      { label: "Copy reference" },
      { label: "Done", divider: true },
    ],
  },
  render: (args) => (
    <ConsoleComponentFrame>
      <MissionsList {...args} />
    </ConsoleComponentFrame>
  ),
} satisfies Meta<typeof MissionsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Today by system, with today's scope above and the ungraded count on Triage. */
export const Today: Story = {};

/** The backlog in the quadrant grid, one column at this width. */
export const BacklogGrid: Story = {
  name: "Backlog Grid",
  args: { range: "backlog", view: "grid" },
};

/** One system folded: its header stays, with its count. */
export const OneFolded: Story = {
  name: "One Folded",
  args: { folded: new Set(["kestrel"]) },
};

/** A search that matches one task; the note says how many are hidden. */
export const Searching: Story = { args: { query: "scanner" } };

/** The filter reports a change; the page decides what it means. */
export const ChangeTheFilter: Story = {
  name: "Change the Filter",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Filter for the task list" }),
    );
    await userEvent.click(
      canvas.getByRole("menuitemcheckbox", {
        name: /^Show approved and merged/,
      }),
    );
    await expect(args.onFilter).toHaveBeenCalledWith({
      done: false,
      waiting: true,
    });
  },
};

/** Narrowed to one system by the scope button. */
export const OneSystem: Story = {
  name: "One System",
  args: { scope: "kestrel" },
};

/** The range and view switches report the choice; the page decides what it means. */
export const SwitchRangeAndView: Story = {
  name: "Switch Range and View",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Backlog" }));
    await expect(args.onRangeChange).toHaveBeenCalledWith("backlog");
    await userEvent.click(canvas.getByRole("button", { name: "Grid" }));
    await expect(args.onViewChange).toHaveBeenCalledWith("grid");
  },
};
