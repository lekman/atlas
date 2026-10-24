import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  sampleEvents,
  WorldDemonstration,
} from "../stories/WorldDemonstration";
import { storyLighting } from "../stories/WorldFrame";

/** The Mariner world on its own: the full map, the compact map, and each kind of event. */
const meta = {
  title: "Worlds/Mariner",
  component: WorldDemonstration,
  parameters: { layout: "fullscreen" },
  render: (args, { globals }) => (
    <WorldDemonstration {...args} lighting={storyLighting(globals)} />
  ),
  args: { world: "mariner", events: [], detail: "full" },
} satisfies Meta<typeof WorldDemonstration>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole map at overview zoom, with every label the full view draws. */
export const FullMap: Story = { name: "Full Map" };

/**
 * Halcyon Labs up close, where a running ship sails to its cargo, heaves to
 * beside it and fishes it with a line and a bobbing float. Schema works the
 * cut-over, then sails to the database tests after twenty seconds, and back
 * again.
 */
export const AgentsAtWork: Story = {
  name: "Agents at Work",
  args: { zoomClientId: "halcyon" },
};

/** The map as the sidebar shows it: client and home names only. */
export const CompactMap: Story = {
  name: "Compact Map",
  args: { detail: "compact" },
};

/** One agent messaging another, drawn as this world sends a message. */
export const MessageBetweenAgents: Story = {
  name: "Message Between Agents",
  args: { events: [sampleEvents.message] },
};

/** An event from an outside system, such as a CI result, arriving on the map. */
export const EventFromOutside: Story = {
  name: "Event from Outside",
  args: { events: [sampleEvents.outside] },
};

/** An agent starts waiting for you, and gains the pulsing ring every world uses. */
export const AgentStartsWaiting: Story = {
  name: "Agent Starts Waiting",
  args: { events: [sampleEvents.waiting] },
};

/** A question answered, and the decision it becomes. */
export const QuestionAnswered: Story = {
  name: "Question Answered",
  args: { events: [sampleEvents.answered] },
};

/** Night watch: the chart on navy, every lighthouse lit and sweeping, ships showing masthead lights. */
export const NightWatch: Story = {
  name: "Night Watch",
  globals: { lighting: "night" },
};

/** At night, a question answered: the fog lifts and the new lighthouse flares, then sweeps with the rest. */
export const NightQuestionAnswered: Story = {
  name: "Night Watch, Question Answered",
  args: { events: [sampleEvents.answered] },
  globals: { lighting: "night" },
};
