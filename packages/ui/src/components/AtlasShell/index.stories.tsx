import { sampleDataset } from "@atlas/fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AtlasShell } from ".";
import { storyWorld } from "../../stories/WorldFrame";

const meta = {
  title: "Components/Atlas Shell",
  component: AtlasShell,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { dataset: sampleDataset, initialMode: "compact" },
  render: (args, { globals }) => (
    <div style={{ height: "100vh" }}>
      <AtlasShell
        {...args}
        key={storyWorld(globals)}
        initialWorld={storyWorld(globals)}
      />
    </div>
  ),
} satisfies Meta<typeof AtlasShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The shell on its own, with no scripted day, so the Controls tab can try
 * each input. The composed examples on real screen sizes are under Pages.
 */
export const Compact: Story = {};

/** The full view: map, readout, log, and the inspector when you pick. */
export const Full: Story = { args: { initialMode: "full" } };
