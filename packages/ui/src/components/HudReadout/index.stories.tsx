import { sampleDataset } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { HudReadout } from ".";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

const meta = {
  title: "Components/HUD Readout",
  component: HudReadout,
  tags: ["autodocs"],
  args: {
    world: worlds.astronomer,
    dataset: sampleDataset,
    camera: { x: 210, y: 160, scale: 0.4 },
    viewport: { width: 420, height: 320 },
  },
  render: (args, { globals }) => (
    <WorldFrame
      world={storyWorld(globals)}
      lighting={storyLighting(globals)}
      width={520}
    >
      <div style={{ position: "relative", height: 200 }}>
        <HudReadout {...args} world={worlds[storyWorld(globals)]} />
      </div>
    </WorldFrame>
  ),
} satisfies Meta<typeof HudReadout>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The counts the full map shows in its corner, in the chosen world's
 * words. What needs you is in the waiting colour.
 */
export const OnTheSampleDay: Story = { name: "On the Sample Day" };
