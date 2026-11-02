import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { HostCard } from ".";
import { STORY_NOW } from "../stories/examples";
import {
  buildServer,
  clientOfHost,
  laptopWarning,
  quietHost,
  runnerPool,
  serverCritical,
} from "../stories/hosts";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Hosts/Host Card",
  component: HostCard,
  tags: ["autodocs"],
  args: {
    host: runnerPool,
    client: clientOfHost(runnerPool),
    open: true,
    onToggle: () => undefined,
    now: STORY_NOW,
    live: true,
    storedAt: null,
  },
  render: function Render(args, { globals }) {
    const [open, setOpen] = useState(args.open);
    return (
      <SidebarStoryFrame globals={globals}>
        <section className="panel">
          <div className="hosts">
            <HostCard
              {...args}
              client={clientOfHost(args.host)}
              open={open}
              onToggle={() => setOpen(!open)}
            />
          </div>
        </section>
      </SidebarStoryFrame>
    );
  },
} satisfies Meta<typeof HostCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A runner pool, open: its latest values, how many runners are busy, and
 * three 24-hour lines with their limits dashed.
 */
export const Runners: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Runners busy")).toBeInTheDocument();
    await expect(canvas.getByText("of 6")).toBeInTheDocument();
    await expect(canvas.getByText("last seen 2m ago")).toBeInTheDocument();
  },
};

/** Closed, as every card starts: name, client and a status dot. */
export const Closed: Story = {
  args: { open: false, host: buildServer },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: /build-01/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText("Disk free")).toBeInTheDocument();
  },
};

/** A warning: yellow border, dot and value, and a tag naming the metric. */
export const Warning: Story = {
  args: { host: laptopWarning },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("img", { name: "warning" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/disk free warning/i)).toBeInTheDocument();
  },
};

/** Critical: red for the worst breach, yellow for the lesser one. */
export const Critical: Story = {
  args: { host: serverCritical },
};

/** Not heard from for 52 minutes, and no samples to draw. */
export const Stale: Story = {
  args: { host: quietHost },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("last seen 52m ago"),
    ).toHaveClass("stale");
  },
};

/** From a stored copy: last seen is measured against the copy, not now. */
export const FromStoredCopy: Story = {
  name: "From Stored Copy",
  args: {
    host: runnerPool,
    live: false,
    storedAt: new Date(STORY_NOW.getTime() - 60 * 60000),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/before this copy/),
    ).toBeInTheDocument();
  },
};
