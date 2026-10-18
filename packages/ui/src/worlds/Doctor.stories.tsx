import type { AtlasEvent } from "@atlas/core";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  sampleEvents,
  WorldDemonstration,
} from "../stories/WorldDemonstration";
import { storyLighting } from "../stories/WorldFrame";

/** The Doctor world on its own: the full map, the compact map, each kind of event, and the night shift. */
const meta = {
  title: "Worlds/Doctor",
  component: WorldDemonstration,
  parameters: { layout: "fullscreen" },
  render: (args, { globals }) => (
    <WorldDemonstration {...args} lighting={storyLighting(globals)} />
  ),
  args: { world: "doctor", events: [], detail: "full" },
} satisfies Meta<typeof WorldDemonstration>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A message from home to another client, so it travels between two places. */
const ambulanceRun: AtlasEvent = {
  type: "agent-message",
  from: "roll-call",
  to: "tracking",
  text: "Roll call: where do you stand?",
};

/** The whole district at overview zoom, with every label the full view draws. */
export const FullMap: Story = { name: "Full Map" };

/** The map as the sidebar shows it: hospital and home names only. */
export const CompactMap: Story = {
  name: "Compact Map",
  args: { detail: "compact" },
};

/** One agent messaging another in the same hospital: a porter's trolley. */
export const MessageBetweenAgents: Story = {
  name: "Message Between Agents",
  args: { events: [sampleEvents.message] },
};

/** A message from The Practice to a hospital: an ambulance runs the streets. */
export const AmbulanceRun: Story = {
  name: "Ambulance Run",
  args: { events: [ambulanceRun] },
};

/** An event from an outside system arriving by air ambulance. */
export const EventFromOutside: Story = {
  name: "Event from Outside",
  args: { events: [sampleEvents.outside] },
};

/** An agent starts waiting for you, and gains the pulsing ring every world uses. */
export const AgentStartsWaiting: Story = {
  name: "Agent Starts Waiting",
  args: { events: [sampleEvents.waiting] },
};

/** A question answered, and the recorded diagnosis it becomes. */
export const QuestionAnswered: Story = {
  name: "Question Answered",
  args: { events: [sampleEvents.answered] },
};

/** The night shift: the same district after dark, windows and street lights lit. */
export const NightShift: Story = {
  name: "Night Shift",
  globals: { lighting: "night" },
};

/** An ambulance run at night, its light bar flashing white and violet. */
export const NightShiftMessage: Story = {
  name: "Night Shift Message",
  globals: { lighting: "night" },
  args: { events: [ambulanceRun] },
};
