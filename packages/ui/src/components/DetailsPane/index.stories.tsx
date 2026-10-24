import { sampleDataset, sampleDayPlan } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DetailsPane } from ".";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

// The day plan's tasks carry the planning fields the map's dataset leaves
// out: a tracker key, effort and value, a history and a details document.
const rehearsal = sampleDayPlan.items.find(
  (item) => item.id === "rehearse-cut-over",
);
if (!rehearsal?.detailsId) throw new Error("the rehearsal has a document");
const runbook = sampleDayPlan.documents.find(
  (document) => document.id === rehearsal.detailsId,
);
if (!runbook) throw new Error("the day plan has the runbook");
const planned = {
  ...sampleDataset,
  items: [...sampleDataset.items, rehearsal],
};

const meta = {
  title: "Components/Details Pane",
  tags: ["autodocs"],
  component: DetailsPane,
  args: {
    dataset: sampleDataset,
    world: worlds.astronomer,
    id: "alarms-live",
    today: sampleDayPlan.today,
    onClose: fn(),
    onSelect: fn(),
    onOpenInObsidian: fn(),
  },
  render: (args, { globals }) => {
    const id = storyWorld(globals);
    return (
      <WorldFrame world={id} lighting={storyLighting(globals)} width={720}>
        <div style={{ height: 640 }}>
          <DetailsPane {...args} world={worlds[id]} />
        </div>
      </WorldFrame>
    );
  },
} satisfies Meta<typeof DetailsPane>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A question: who must answer, its state, and the work it blocks, which a
 * click selects next.
 */
export const AQuestion: Story = {
  name: "A Question",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Who answers")).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: /rehearse the tenant cut-over/i }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith("cut-over");
    await userEvent.click(
      canvas.getByRole("button", { name: "Close details" }),
    );
    await expect(args.onClose).toHaveBeenCalled();
  },
};

/**
 * A planned task: schedule, tracker key as a link that opens in a new tab,
 * effort, value, history, and its details document read in place.
 */
export const APlannedTaskWithADocument: Story = {
  name: "A Planned Task with a Document",
  args: { dataset: planned, id: rehearsal.id, document: runbook },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tracker = canvas.getByRole("link", { name: "HAL-142" });
    await expect(tracker).toHaveAttribute("target", "_blank");
    await expect(tracker).toHaveAttribute("rel", "noopener noreferrer");
    await expect(canvas.getByText("Effort")).toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: "History" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: runbook.title }),
    ).toBeInTheDocument();
  },
};

/** An agent: its status, what it is doing now, and where it runs. */
export const AnAgent: Story = {
  name: "An Agent",
  args: { id: "release" },
};
