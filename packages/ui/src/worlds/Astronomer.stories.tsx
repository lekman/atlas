import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  sampleEvents,
  WorldDemonstration,
} from "../stories/WorldDemonstration";

/** The Astronomer world on its own: the full map, the compact map, and each kind of event. */
const meta = {
  title: "Worlds/Astronomer",
  component: WorldDemonstration,
  parameters: { layout: "fullscreen" },
  args: { world: "astronomer", events: [], detail: "full" },
} satisfies Meta<typeof WorldDemonstration>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullMap: Story = { name: "Full Map" };
export const CompactMap: Story = {
  name: "Compact Map",
  args: { detail: "compact" },
};
export const MessageBetweenAgents: Story = {
  name: "Message Between Agents",
  args: { events: [sampleEvents.message] },
};
export const EventFromOutside: Story = {
  name: "Event from Outside",
  args: { events: [sampleEvents.outside] },
};
export const AgentStartsWaiting: Story = {
  name: "Agent Starts Waiting",
  args: { events: [sampleEvents.waiting] },
};
export const QuestionAnswered: Story = {
  name: "Question Answered",
  args: { events: [sampleEvents.answered] },
};
