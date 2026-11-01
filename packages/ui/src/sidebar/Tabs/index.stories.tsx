import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { TabPanel, Tabs } from ".";
import { exampleTabs, exampleViews } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";
import { visibleViews } from "../views";

const all = visibleViews(exampleViews, "all", "worklist");

const meta = {
  title: "Sidebar/Frame/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: {
    label: "Views",
    idPrefix: "story",
    tabs: exampleTabs(all.views),
    selected: "worklist",
    onSelect: fn(),
  },
  render: function Render(args, { globals }) {
    const [selected, setSelected] = useState(args.selected);
    return (
      <SidebarStoryFrame globals={globals}>
        <Tabs
          {...args}
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            args.onSelect(id);
          }}
        />
        {args.tabs.map((t) => (
          <TabPanel
            key={t.id}
            idPrefix={args.idPrefix}
            id={t.id}
            selected={selected}
          >
            <p>{t.label}</p>
          </TabPanel>
        ))}
      </SidebarStoryFrame>
    );
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every client shown: each client with a tracker has its own tab, named
 * after the client. Host alerts sit at the far end.
 */
export const AllClients: Story = {
  name: "All Clients",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: /calendar/i }));
    await expect(args.onSelect).toHaveBeenLastCalledWith("agenda");
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("Calendar");
  },
};

/**
 * One client chosen: the other clients' tabs go, this client's tabs are
 * named after their source, and its release tab appears.
 */
export const OneClient: Story = {
  name: "One Client",
  args: {
    tabs: exampleTabs(visibleViews(exampleViews, "kestrel", "worklist").views),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: /monday/i })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: /release/i })).toBeVisible();
    await expect(canvas.queryByRole("tab", { name: /jira/i })).toBeNull();
  },
};

/** A host has a warning: the tab turns yellow with the count. */
export const HostWarning: Story = {
  name: "Host Warning",
  args: { tabs: exampleTabs(all.views, "warn") },
};

/** A host is critical: the tab turns red. */
export const HostCritical: Story = {
  name: "Host Critical",
  args: { tabs: exampleTabs(all.views, "crit") },
};

/** Arrow keys, Home and End move between tabs and open each one. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("tab", { selected: true }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("tab", { name: /calendar/i })).toHaveFocus();
    await expect(args.onSelect).toHaveBeenLastCalledWith("agenda");
    await userEvent.keyboard("{End}");
    await expect(
      canvas.getByRole("tab", { name: /host alerts/i }),
    ).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{ArrowLeft}");
    await expect(args.onSelect).toHaveBeenLastCalledWith("hosts");
  },
};
