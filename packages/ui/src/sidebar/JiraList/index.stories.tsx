import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { JiraList } from ".";
import { STORY_NOW } from "../stories/examples";
import { jiraExample } from "../stories/jira";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Trackers/Jira List",
  component: JiraList,
  tags: ["autodocs"],
  args: {
    title: "Halcyon Labs · Jira, assigned to me",
    doc: jiraExample,
    folded: new Set<string>(),
    onFold: () => undefined,
    today: "2026-03-12",
    now: STORY_NOW,
  },
  render: function Render(args, { globals }) {
    const [folded, setFolded] = useState(new Set(args.folded));
    return (
      <SidebarStoryFrame globals={globals}>
        <JiraList
          {...args}
          folded={folded}
          onFold={(g) => {
            const next = new Set(folded);
            if (!next.delete(g)) next.add(g);
            setFolded(next);
          }}
        />
      </SidebarStoryFrame>
    );
  },
} satisfies Meta<typeof JiraList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * In progress first, blocked at its top; an overdue date in red. Test
 * plans stay out. Groups fold.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("4 not done")).toBeInTheDocument();
    await expect(canvas.queryByText(/regression suite/i)).toBeNull();
    await expect(canvas.getByText(/overdue/)).toHaveClass("crit");
    await userEvent.click(canvas.getByRole("button", { name: /to do/i }));
    await expect(canvas.queryByText(/offline mode/i)).toBeNull();
  },
};

/** "To do" folded, as it starts before any choice is saved. */
export const ToDoFolded: Story = {
  name: "To Do Folded",
  args: { folded: new Set(["new"]) },
};

/** The sync isn't set up on the Mac: amber, with what to do. */
export const NotConfigured: Story = {
  name: "Not Configured",
  args: { doc: { ok: false, error: "not_configured", items: [] } },
};

/** The token expired: red. */
export const Rejected: Story = {
  args: { doc: { ok: false, error: "http_401", items: [] } },
};

/** Never synced. */
export const NoSyncYet: Story = {
  name: "No Sync Yet",
  args: { doc: null },
};

/** Nothing assigned that isn't done. */
export const Empty: Story = {
  args: { doc: { ok: true, syncedAt: STORY_NOW.toISOString(), items: [] } },
};
