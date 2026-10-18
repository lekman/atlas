import type { AtlasEvent } from "@atlas/core";
import { sampleDataset, sampleScript } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { LogPanel } from ".";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";
import type { LogEntry } from "../../useAtlasMap";

const events = sampleScript
  .filter((step): step is AtlasEvent => step.type !== "reset")
  .slice(0, 8);
const entries: LogEntry[] = events
  .map((event, index) => ({
    id: index + 1,
    time: new Date(Date.UTC(2026, 9, 18, 9, 41, index * 7)),
    event,
    before: sampleDataset,
  }))
  .reverse();

const meta = {
  title: "Components/Log Panel",
  tags: ["autodocs"],
  component: LogPanel,
  args: { entries, world: worlds.astronomer, variant: "preview" },
  render: (args, { globals }) => {
    const id = storyWorld(globals);
    return (
      <WorldFrame world={id} lighting={storyLighting(globals)} width={480}>
        <LogPanel {...args} world={worlds[id]} />
      </WorldFrame>
    );
  },
} satisfies Meta<typeof LogPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The latest lines, as the sidebar shows them under the map. */
export const InTheSidebar: Story = { name: "In the Sidebar" };

/** Floating over the full map, with seconds on the clock. */
export const OverTheFullMap: Story = {
  name: "Over the Full Map",
  args: { variant: "panel" },
};

/** Before the first event arrives. */
export const Empty: Story = { args: { entries: [] } };
