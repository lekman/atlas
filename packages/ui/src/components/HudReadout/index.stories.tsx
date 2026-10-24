import { sampleDataset } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { HudReadout } from ".";
import { Inspector } from "../Inspector";
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
    onSelect: fn(),
  },
  render: (args, { globals }) => (
    <WorldFrame
      world={storyWorld(globals)}
      lighting={storyLighting(globals)}
      width={520}
    >
      <div style={{ position: "relative", height: 460 }}>
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

/** Opened from the handle: everything that needs you, above the counts. */
export const WithTheListOpen: Story = {
  name: "With the List Open",
  args: { initialListHeight: 240 },
};

/**
 * A click on the handle opens the list, and choosing an entry reports it,
 * so the full view can open its card.
 */
export const OpenFromTheHandle: Story = {
  name: "Open from the Handle",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const handle = canvas.getByRole("button", { name: /show what needs you/i });
    await expect(handle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(handle);
    await expect(
      canvas.getByRole("button", { name: /hide what needs you/i }),
    ).toHaveAttribute("aria-expanded", "true");
    const entries = canvas.getAllByRole("listitem");
    await expect(entries.length).toBeGreaterThan(0);
    await userEvent.click(within(entries[0]!).getByRole("button"));
    await expect(args.onSelect).toHaveBeenCalled();
  },
};

/**
 * A record selected while the list is closed: the list opens to fit, and
 * the record expands in place of its one-line entry, with its buttons.
 */
export const WithARecordSelected: Story = {
  name: "With a Record Selected",
  args: {
    selectedId: "day-rate",
    selected: (
      <Inspector
        dataset={sampleDataset}
        world={worlds.astronomer}
        id="day-rate"
        variant="embedded"
        onClose={fn()}
        onSelect={fn()}
        onAction={fn()}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("article", { name: /raise the day rate/i }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: /hide what needs you/i }),
    ).toHaveAttribute("aria-expanded", "true");
  },
};

/** A record that does not need you shows in a Selected section above the list. */
export const WithAnotherRecordSelected: Story = {
  name: "With Another Record Selected",
  args: {
    selectedId: "cut-over",
    selected: (
      <Inspector
        dataset={sampleDataset}
        world={worlds.astronomer}
        id="cut-over"
        variant="embedded"
        onClose={fn()}
        onSelect={fn()}
        onAction={fn()}
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const section = await canvas.findByRole("region", { name: "Selected" });
    await expect(
      within(section).getByRole("article", {
        name: /rehearse the tenant cut-over/i,
      }),
    ).toBeInTheDocument();
  },
};
