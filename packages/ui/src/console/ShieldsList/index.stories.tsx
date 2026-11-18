import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { STORY_NOW } from "../../sidebar/stories/examples";
import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { storyHosts, storyIntegrations } from "../stories/shields";
import { ShieldsList } from ".";

const meta = {
  title: "Components/Console/Shields List",
  tags: ["autodocs"],
  component: ShieldsList,
  args: {
    hosts: storyHosts,
    hostsLive: true,
    hostsStoredAt: null,
    relay: { kind: "live" },
    integrations: storyIntegrations,
    now: STORY_NOW,
    onSelect: fn(),
  },
  render: (args) => (
    <ConsoleComponentFrame>
      <ShieldsList {...args} />
    </ConsoleComponentFrame>
  ),
} satisfies Meta<typeof ShieldsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hosts with a disk warning and a quiet edge host, the relay live, and one failing sync. */
export const Mixed: Story = {};

/** Before the first host figures arrive, with changes queued for the Mac mini. */
export const WaitingAndQueued: Story = {
  name: "Waiting and Queued",
  args: { hosts: null, relay: { kind: "queued", count: 2 } },
};

/** Opening a row reports it; its state is read out before its name. */
export const OpenARow: Story = {
  name: "Open a Row",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /^Needs a look: laptop/ }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "host:laptop", state: "warn" }),
    );
  },
};
