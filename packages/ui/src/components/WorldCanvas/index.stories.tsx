import { worldIds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { WorldDemonstration } from "../../stories/WorldDemonstration";

/**
 * The live map with every world and both levels of detail in the controls.
 * Each world also has its own page of stories under Worlds.
 */
const meta = {
  title: "Components/World Canvas",
  tags: ["autodocs"],
  component: WorldDemonstration,
  parameters: { layout: "fullscreen" },
  args: { world: "astronomer", events: [], detail: "full", lighting: "day" },
  argTypes: {
    world: { control: "inline-radio", options: worldIds },
    detail: { control: "inline-radio", options: ["compact", "full"] },
    lighting: { control: "inline-radio", options: ["day", "night"] },
  },
} satisfies Meta<typeof WorldDemonstration>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick any world and detail from the controls. */
export const AnyWorld: Story = { name: "Any World" };
