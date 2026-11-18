import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { STORY_NOW } from "../../sidebar/stories/examples";
import { laptopWarning, serverCritical } from "../../sidebar/stories/hosts";
import { relayRow } from "../shields";
import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { storyIntegrations } from "../stories/shields";
import { ShieldDetail } from ".";

const meta = {
  title: "Components/Console/Shield Detail",
  tags: ["autodocs"],
  component: ShieldDetail,
  args: {
    row: {
      id: "host:laptop",
      kind: "host",
      name: "laptop",
      state: "warn",
      summary: "",
    },
    host: laptopWarning,
    hostsLive: true,
    now: STORY_NOW,
  },
  render: (args) => (
    <ConsoleComponentFrame width={445}>
      <ShieldDetail {...args} />
    </ConsoleComponentFrame>
  ),
} satisfies Meta<typeof ShieldDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A host with its disk over the warning limit, and its last 24 hours as lines with the limits dashed. */
export const HostWarning: Story = {
  name: "Host Warning",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/over its warning limit/),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("img", { name: /Disk free GB over the last 24 hours/ }),
    ).toBeInTheDocument();
  },
};

/** A server out of memory: a critical breach. */
export const HostAlert: Story = {
  name: "Host Alert",
  args: {
    row: {
      id: "host:build-01",
      kind: "host",
      name: "build-01",
      state: "alert",
      summary: "",
    },
    host: serverCritical,
  },
};

/** The relay with two changes waiting for the Mac mini. */
export const RelayQueued: Story = {
  name: "Relay Queued",
  args: {
    row: relayRow({ kind: "queued", count: 2 }),
    host: undefined,
    relay: { kind: "queued", count: 2 },
    liveAt: null,
    syncedAt: new Date(STORY_NOW.getTime() - 40 * 60000).toISOString(),
  },
};

/** An integration whose sync failed, with the reason. */
export const IntegrationFailing: Story = {
  name: "Integration Failing",
  args: {
    row: {
      id: "integration:calendar",
      kind: "integration",
      name: "Calendars",
      state: "alert",
      summary: "",
    },
    host: undefined,
    integration: storyIntegrations[3]!,
  },
};
