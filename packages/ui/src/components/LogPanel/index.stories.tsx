import type { AtlasEvent } from "@atlas/core";
import {
  sampleDataset,
  sampleItemLogs,
  sampleLogNow,
  sampleScript,
} from "@atlas/fixtures";
import { worlds, type World } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { LogPanel } from ".";
import { recordLogLines } from "../../recordLog";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";
import type { LogEntry } from "../../useAtlasMap";

const events = sampleScript
  .filter((step): step is AtlasEvent => step.type !== "reset")
  .slice(0, 14);
const entries: LogEntry[] = events
  .map((event, index) => ({
    id: index + 1,
    time: new Date(Date.UTC(2026, 9, 24, 9, index * 4)),
    event,
    before: sampleDataset,
  }))
  .reverse();

const minute = 60 * 1000;
const [firstEvent, secondEvent] = events;

/**
 * The same lines with two more at the edge of the window: one 23 hours 59
 * minutes before the story's moment, which stays, and one 24 hours 1
 * minute before it, which drops out.
 */
const atTheEdge: LogEntry[] =
  firstEvent && secondEvent
    ? [
        ...entries,
        {
          id: 100,
          time: new Date(sampleLogNow.getTime() - (24 * 60 - 1) * minute),
          event: firstEvent,
          before: sampleDataset,
        },
        {
          id: 101,
          time: new Date(sampleLogNow.getTime() - (24 * 60 + 1) * minute),
          event: secondEvent,
          before: sampleDataset,
        },
      ]
    : entries;

/** The sample item's log in a world's voice. */
const webhookLines = (world: World) =>
  recordLogLines({
    world,
    dataset: sampleDataset,
    recordId: "webhooks",
    entries,
    itemLog: sampleItemLogs.webhooks ?? [],
  });

const meta = {
  title: "Components/Log Panel",
  tags: ["autodocs"],
  component: LogPanel,
  args: {
    entries,
    world: worlds.astronomer,
    variant: "preview",
    now: sampleLogNow,
  },
  render: (args, { globals }) => {
    const id = storyWorld(globals);
    const world = worlds[id];
    // A subject's lines are written in the world chosen in the toolbar.
    const subject = args.subject
      ? {
          ...args.subject,
          kind: `${world.vocabulary.item} · backlog item`,
          lines: webhookLines(world),
        }
      : null;
    return (
      <WorldFrame world={id} lighting={storyLighting(globals)} width={480}>
        {args.variant === "panel" ? (
          // The column is placed against the full map; here a box stands in for it.
          <div style={{ position: "relative", height: 560 }}>
            <LogPanel {...args} world={world} subject={subject} />
          </div>
        ) : (
          <LogPanel {...args} world={world} />
        )}
      </WorldFrame>
    );
  },
} satisfies Meta<typeof LogPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The latest lines, as the sidebar shows them under the map. */
export const InTheSidebar: Story = { name: "In the Sidebar" };

/** The column down the left of the full map, with seconds on the clock. */
export const BesideTheFullMap: Story = {
  name: "Beside the Full Map",
  args: { variant: "panel" },
};

/**
 * Narrowed to a selected backlog item: its map events and its item log,
 * merged newest first, each line naming who it came from.
 */
export const ForASelectedItem: Story = {
  name: "For a Selected Item",
  args: {
    variant: "panel",
    subject: {
      name: "Partner webhooks",
      kind: "backlog item",
      lines: webhookLines(worlds.astronomer),
    },
  },
};

/**
 * The log keeps the last 24 hours. Of two lines at the edge, the one 23
 * hours 59 minutes old stays and the one 24 hours 1 minute old is gone, so
 * the count reads 15 of the 16 given. Every line shows its time of day and
 * no date.
 */
export const LastTwentyFourHours: Story = {
  name: "Last Twenty-Four Hours",
  args: { variant: "panel", entries: atTheEdge },
  play: async ({ canvasElement }) => {
    const log = within(canvasElement);
    await expect(log.getByText("15 entries")).toBeInTheDocument();
    const stamps = canvasElement.querySelectorAll("time");
    await expect(stamps).toHaveLength(15);
    for (const stamp of stamps)
      await expect(stamp.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  },
};

/** Before the first event arrives. */
export const Empty: Story = { args: { entries: [] } };
