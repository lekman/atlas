import { sampleDataset, sampleDayPlan } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DetailsReader } from ".";
import { EveryWorld } from "../../stories/EveryWorld";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

const [runbook, retries] = sampleDayPlan.documents;
if (!runbook || !retries) throw new Error("the day plan has two documents");
const rehearsal = sampleDayPlan.items.find(
  (item) => item.detailsId === runbook.id,
);
const clientName = (id: string) =>
  sampleDataset.clients.find((client) => client.id === id)?.name ?? id;

const meta = {
  title: "Components/Details Reader",
  tags: ["autodocs"],
  component: DetailsReader,
  args: {
    document: runbook,
    world: worlds.astronomer,
    clientName: clientName(runbook.clientId),
    today: sampleDayPlan.today,
    tracker: rehearsal?.tracker,
    onClose: fn(),
    onOpenInObsidian: fn(),
    onOpenTicket: fn(),
  },
  render: (args, { globals }) => {
    const id = storyWorld(globals);
    return (
      <WorldFrame world={id} lighting={storyLighting(globals)} width={720}>
        <div style={{ height: 640, display: "flex", flexDirection: "column" }}>
          <DetailsReader {...args} world={worlds[id]} />
        </div>
      </WorldFrame>
    );
  },
} satisfies Meta<typeof DetailsReader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The long runbook as a tight-beam transmission: headings, a table, code,
 * callouts, a task list, wiki-links, an embed, and raw HTML shown as text.
 */
export const ATransmission: Story = {
  name: "A Transmission",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Tenant cut-over rehearsal" }),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/^Details/)).toBeInTheDocument();
    // The note's <script> is text on the page, and no script element exists.
    await expect(canvas.getByText(/alert\("never runs"\)/)).toBeInTheDocument();
    await expect(canvasElement.querySelector(".atlas-prose script")).toBeNull();
    await expect(canvasElement.querySelector(".atlas-prose b")).toBeNull();
  },
};

/** Close, Open in Obsidian and Open ticket only report what was pressed. */
export const PlainButtons: Story = {
  name: "Plain Buttons",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Open in Obsidian" }),
    );
    await expect(args.onOpenInObsidian).toHaveBeenCalledWith(
      runbook.sourcePath,
    );
    await userEvent.click(canvas.getByRole("button", { name: "Open ticket" }));
    await expect(args.onOpenTicket).toHaveBeenCalledWith(
      rehearsal?.tracker?.url,
    );
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

/** A short note with no tracker link, so there is no Open ticket button. */
export const NoTicket: Story = {
  name: "No Ticket",
  args: {
    document: retries,
    clientName: clientName(retries.clientId),
    tracker: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("button", { name: "Open ticket" }),
    ).not.toBeInTheDocument();
  },
};

/** With somewhere to go, a wiki-link becomes a button that reports its target. */
export const WikiLinksOpen: Story = {
  name: "Wiki-Links Open",
  args: { onOpenWikiLink: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "the client brief" }),
    );
    await expect(args.onOpenWikiLink).toHaveBeenCalledWith(
      "Halcyon Labs brief",
    );
  },
};

/** The short note in each world's palette: the plain reading panel everywhere but the Astronomer. */
export const InEveryWorld: Story = {
  name: "In Every World",
  args: {
    document: retries,
    clientName: clientName(retries.clientId),
    tracker: undefined,
  },
  render: (args) => (
    <EveryWorld width={560}>
      {(world) => <DetailsReader {...args} world={world} />}
    </EveryWorld>
  ),
};
