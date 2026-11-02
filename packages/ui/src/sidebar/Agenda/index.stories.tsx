import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Agenda } from ".";
import { agendaDays } from "../calendar/model";
import { Note } from "../Note";
import { weekDays, weekEvents } from "../stories/calendar";
import { exampleClients, STORY_NOW } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const clientOf = (key: string) =>
  exampleClients.find((c) => c.key === key) ?? {
    name: "Other",
    colour: "var(--client-other)",
  };

const meta = {
  title: "Sidebar/Calendar/Agenda",
  component: Agenda,
  tags: ["autodocs"],
  args: { days: weekDays, scope: "All customers", clientOf, now: STORY_NOW },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <Agenda {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof Agenda>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Seven days from today. The meeting under way is highlighted and tagged
 * now, the one before it fades. Halcyon Labs has no calendar yet, so its
 * placeholders show hatched and tagged sample.
 */
export const Week: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("now")).toHaveLength(2);
    await expect(canvas.getAllByText("sample").length).toBeGreaterThan(0);
    await expect(
      canvas.getByRole("link", { name: "Join call" }),
    ).toHaveAttribute("href", "https://meet.example/kf");
    await expect(canvas.getByText("Company holiday")).toBeInTheDocument();
  },
};

/** One client chosen: only its events. */
export const OneClient: Story = {
  name: "One Client",
  args: {
    scope: "Kestrel Freight only",
    days: agendaDays(
      weekEvents.filter((e) => e.client === "kestrel"),
      STORY_NOW,
    ),
  },
};

/** A calendar connector refused, above the events the others still give. */
export const WithError: Story = {
  name: "With Error",
  args: {
    notes: (
      <Note tone="err">
        Work calendar: Microsoft 365 needs reconnecting. Reconnect it in
        claude.ai Settings → Connectors.
      </Note>
    ),
  },
};

/** Before the first answer. */
export const Loading: Story = {
  args: { days: null },
};
