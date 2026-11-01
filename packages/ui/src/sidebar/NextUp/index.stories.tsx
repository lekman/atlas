import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { NextUp } from ".";
import { ClientPill } from "../ClientPill";
import { exampleClients } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Frame/Next Up",
  component: NextUp,
  tags: ["autodocs"],
  args: {
    state: "next",
    title: "Halcyon Labs weekly with the data team",
    countdown: "in 20 min",
    when: "10:00–10:45 · Halcyon Labs",
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <NextUp {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof NextUp>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The next meeting and how long until it starts. */
export const Next: Story = {};

/** A meeting under way says when it ends. */
export const InProgress: Story = {
  name: "In Progress",
  args: {
    state: "now",
    title: "Kestrel Freight release review",
    countdown: "ends in 35 min",
    when: "09:30–10:15 · Kestrel Freight",
  },
};

/** A long title ends in "…" rather than wrapping. */
export const LongTitle: Story = {
  name: "Long Title",
  args: {
    title:
      "Meridian Bank quarterly access review with security, audit and the platform team, part two",
  },
};

/** Nothing in the calendar for the next week. */
export const NothingComing: Story = {
  name: "Nothing Coming",
  args: {
    title: undefined,
    countdown: undefined,
    when: undefined,
    empty: "Nothing in the next 7 days",
  },
};

/** With the client pill in its corner, as the sidebar shows it. */
export const WithClientPill: Story = {
  name: "With Client Pill",
  args: {
    corner: <ClientPill clients={exampleClients} focus="all" onChoose={fn()} />,
  },
};
