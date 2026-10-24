import { sampleScript } from "@atlas/fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ScriptedDemonstration } from "../stories/ScriptedDemonstration";
import { storyLighting } from "../stories/WorldFrame";

/**
 * Agents launching smaller vessels: a background agent or subagent leaves
 * its parent, flies to its task, works it as its parent does, and flies
 * back when it returns. Each story replays the scripted day up close on
 * Kestrel Freight, where Tracking launches Retention check and Limit
 * survey, and Limit survey returns a few steps later. The vessels keep
 * working while Tracking waits for you.
 */
const meta = {
  title: "Worlds/Launch Vessels",
  component: ScriptedDemonstration,
  parameters: { layout: "fullscreen" },
  render: (args, { globals }) => (
    <ScriptedDemonstration {...args} lighting={storyLighting(globals)} />
  ),
  args: {
    world: "astronomer",
    script: sampleScript,
    zoomClientId: "kestrel",
  },
} satisfies Meta<typeof ScriptedDemonstration>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * In the Astronomer world a probe launches a smaller craft, a launch, that
 * mines its moon with a finer laser and docks with its probe again.
 */
export const Astronomer: Story = {};

/**
 * In the Mariner world a ship lowers a tender, which fishes its cargo with
 * a finer line and comes back aboard.
 */
export const Mariner: Story = { args: { world: "mariner" } };
