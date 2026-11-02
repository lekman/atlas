import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { HostsPanel } from ".";
import { STORY_NOW } from "../stories/examples";
import { clientOfHost, hostsDoc } from "../stories/hosts";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Hosts/Hosts Panel",
  component: HostsPanel,
  tags: ["autodocs"],
  args: {
    doc: hostsDoc,
    hosts: hostsDoc.hosts,
    live: true,
    error: null,
    allClients: true,
    clientOf: clientOfHost,
    now: STORY_NOW,
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <HostsPanel {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof HostsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Live from the Mac: every card closed; opening one closes the other. */
export const Live: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const runner = canvas.getByRole("button", { name: /runner/ });
    const laptop = canvas.getByRole("button", { name: /laptop/ });
    await userEvent.click(runner);
    await expect(runner).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(laptop);
    await expect(laptop).toHaveAttribute("aria-expanded", "true");
    await expect(runner).toHaveAttribute("aria-expanded", "false");
  },
};

/** On the phone: the stored copy, with its age once at the top. */
export const StoredCopy: Story = {
  name: "Stored Copy",
  args: {
    live: false,
    doc: {
      ...hostsDoc,
      storedAt: new Date(STORY_NOW.getTime() - 25 * 60000).toISOString(),
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/stored copy from 09:15, 25m ago/i),
    ).toBeInTheDocument();
  },
};

/** The local server didn't answer, so the stored copy shows with the reason. */
export const ServerUnavailable: Story = {
  name: "Server Unavailable",
  args: {
    live: false,
    error: {
      tone: "warn",
      text: "The local dashboard server didn't answer. Showing the last data received; it tries again on the next refresh.",
    },
  },
};

/** Nothing yet, and nothing stored. */
export const Loading: Story = {
  args: { doc: null, hosts: [] },
};

/** One client chosen that has no hosts. */
export const NoHostForClient: Story = {
  name: "No Host For Client",
  args: { hosts: [], allClients: false },
};
