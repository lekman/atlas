import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { GitHubList } from ".";
import { STORY_NOW } from "../stories/examples";
import { githubExample } from "../stories/github";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Trackers/GitHub List",
  component: GitHubList,
  tags: ["autodocs"],
  args: {
    title: "Meridian Bank · GitHub issues",
    repo: "meridian-bank/ledger",
    page: githubExample,
    error: null,
    me: "alex-a",
    mine: false,
    onMine: () => undefined,
    folded: new Set<string>(),
    onFold: () => undefined,
    colour: "var(--client-4)",
    updatedAt: new Date(STORY_NOW.getTime() - 2 * 60000),
    now: STORY_NOW,
  },
  render: function Render(args, { globals }) {
    const [mine, setMine] = useState(args.mine);
    const [folded, setFolded] = useState(new Set(args.folded));
    return (
      <SidebarStoryFrame globals={globals}>
        <GitHubList
          {...args}
          mine={mine}
          onMine={setMine}
          folded={folded}
          onFold={(label) => {
            const next = new Set(folded);
            if (!next.delete(label)) next.add(label);
            setFolded(next);
          }}
        />
      </SidebarStoryFrame>
    );
  },
} satisfies Meta<typeof GitHubList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * All open issues, grouped by first label, no label last. A bug or p1
 * label makes the dot red. Groups fold.
 */
export const AllOpen: Story = {
  name: "All Open",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const groups = canvas.getAllByRole("button", { expanded: true });
    await expect(groups.map((g) => g.textContent)).toEqual([
      "bug2",
      "docs1",
      "security2",
      "No label1",
    ]);
    await userEvent.click(groups[0]!);
    await expect(
      canvas.queryByText("Statement export drops the last row"),
    ).toBeNull();
  },
};

/** Narrowed to the operator's issues. */
export const AssignedToMe: Story = {
  name: "Assigned To Me",
  args: { mine: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("link")).toHaveLength(3);
    await userEvent.click(canvas.getByRole("button", { name: "All open" }));
    await expect(canvas.getAllByRole("link")).toHaveLength(6);
  },
};

/** Narrowing asked for, but the login isn't known yet: all show, with a note. */
export const LoginUnknown: Story = {
  name: "Login Unknown",
  args: { mine: true, me: null },
};

/** A large repository: the newest hundred, with the total. */
export const FirstHundred: Story = {
  name: "First Hundred",
  args: { page: { ...githubExample, more: true, total: 240 } },
};

/** Nothing open for the operator. */
export const NoneAssigned: Story = {
  name: "None Assigned",
  args: { mine: true, me: "nobody" },
};

/** The connector needs reconnecting. */
export const NeedsReconnecting: Story = {
  name: "Needs Reconnecting",
  args: {
    page: null,
    error: {
      tone: "err",
      text: "GitHub needs reconnecting. Reconnect it in claude.ai Settings → Connectors.",
    },
  },
};
