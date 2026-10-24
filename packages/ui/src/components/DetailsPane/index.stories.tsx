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

/** A task from the day plan, by id, for the tracking stories. */
function planItem(id: string) {
  const item = sampleDayPlan.items.find((candidate) => candidate.id === id);
  if (!item?.development) throw new Error(`${id} has development tracking`);
  return item;
}
// Every case of development tracking, from the invented day plan.
const merged = planItem("flaky-login");
const branchOnly = planItem("webhook-retries");
const failing = planItem("release-train");

// Grouped under the go-live workstream here, so the pane has Links to show
// in its third column beside History.
const planned = {
  ...sampleDataset,
  items: [
    ...sampleDataset.items,
    { ...rehearsal, workstreamId: "halcyon-go-live" },
    merged,
    branchOnly,
    failing,
  ],
};

/** The pane as wide as it opens on a 2000-pixel window. */
const wide = 1400;
/** A pane narrow enough that the columns fall to one. */
const narrow = 480;

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
  render: (args, { globals, parameters }) => {
    const id = storyWorld(globals);
    const width =
      typeof parameters.paneWidth === "number" ? parameters.paneWidth : 720;
    return (
      <WorldFrame world={id} lighting={storyLighting(globals)} width={width}>
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

/**
 * A wide pane, as it opens between the log and the HUD on a large screen:
 * the fields, Tracking, and History with Links in three columns. The
 * tracking is an open issue, a branch on a worktree and a draft pull
 * request with its checks still running.
 */
export const TrackingInAWidePane: Story = {
  name: "Tracking in a Wide Pane",
  args: { dataset: planned, id: rehearsal.id },
  parameters: { paneWidth: wide },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tracking = within(canvas.getByRole("region", { name: "Tracking" }));
    const issue = tracking.getByRole("link", { name: "#142" });
    await expect(issue).toHaveAttribute(
      "href",
      "https://github.example/halcyon/tenant-platform/issues/142",
    );
    await expect(issue).toHaveAttribute("target", "_blank");
    await expect(issue).toHaveAttribute("rel", "noopener noreferrer");
    await expect(tracking.getByText("open")).toBeInTheDocument();
    await expect(
      tracking.getByText("feature/142-tenant-cut-over-rehearsal"),
    ).toBeInTheDocument();
    await expect(tracking.getByText(/on a worktree/)).toBeInTheDocument();
    await expect(
      tracking.getByText("~/work/tenant-platform-cut-over"),
    ).toBeInTheDocument();
    const pullRequest = tracking.getByRole("link", { name: "#148" });
    await expect(pullRequest).toHaveAttribute("target", "_blank");
    await expect(pullRequest).toHaveAttribute("rel", "noopener noreferrer");
    await expect(tracking.getByText("draft")).toBeInTheDocument();
    await expect(tracking.getByText("checks pending")).toBeInTheDocument();
  },
};

/** The same wide pane in the Mariner, a light world, where contrast is tightest. */
export const TrackingInAWidePaneMariner: Story = {
  ...TrackingInAWidePane,
  name: "Tracking in a Wide Pane, Mariner",
  globals: { world: "mariner" },
};

/** A narrow pane: the columns fall to one, in the same reading order. */
export const TrackingInANarrowPane: Story = {
  name: "Tracking in a Narrow Pane",
  args: { dataset: planned, id: rehearsal.id },
  parameters: { paneWidth: narrow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const columns = canvasElement.querySelector(".atlas-details-columns");
    if (!columns) throw new Error("the pane has its columns");
    const tracks = getComputedStyle(columns)
      .gridTemplateColumns.split(" ")
      .filter(Boolean);
    await expect(tracks).toHaveLength(1);
    const headings = canvas
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    await expect(headings.slice(0, 3)).toEqual([
      "Tracking",
      "History",
      "Links",
    ]);
  },
};

/** The narrow pane in the Mariner. */
export const TrackingInANarrowPaneMariner: Story = {
  ...TrackingInANarrowPane,
  name: "Tracking in a Narrow Pane, Mariner",
  globals: { world: "mariner" },
};

/** Finished work: the issue closed, the pull request merged with its checks passing. */
export const TrackingMerged: Story = {
  name: "Tracking, Merged",
  args: { dataset: planned, id: merged.id },
  parameters: { paneWidth: wide },
  play: async ({ canvasElement }) => {
    const tracking = within(
      within(canvasElement).getByRole("region", { name: "Tracking" }),
    );
    await expect(tracking.getByText("closed")).toBeInTheDocument();
    await expect(tracking.getByText("merged")).toBeInTheDocument();
    await expect(tracking.getByText("checks passing")).toBeInTheDocument();
    await expect(tracking.queryByText(/on a worktree/)).toBeNull();
  },
};

/** Started work: an issue and a branch, with no pull request yet. */
export const TrackingWithoutAPullRequest: Story = {
  name: "Tracking without a Pull Request",
  args: { dataset: planned, id: branchOnly.id },
  parameters: { paneWidth: wide },
  play: async ({ canvasElement }) => {
    const tracking = within(
      within(canvasElement).getByRole("region", { name: "Tracking" }),
    );
    await expect(tracking.getByText("Branch")).toBeInTheDocument();
    await expect(tracking.queryByText("Pull request")).toBeNull();
  },
};

/** A pull request in review whose checks are failing: red, and said in words. */
export const TrackingWithFailingChecks: Story = {
  name: "Tracking with Failing Checks",
  args: { dataset: planned, id: failing.id },
  parameters: { paneWidth: wide },
  play: async ({ canvasElement }) => {
    const tracking = within(
      within(canvasElement).getByRole("region", { name: "Tracking" }),
    );
    const checks = tracking.getByText("checks failing");
    await expect(checks).toHaveAttribute("data-tone", "error");
    // The issue and the pull request are both open.
    await expect(tracking.getAllByText("open")).toHaveLength(2);
  },
};

/** A record with no development tracking shows no Tracking section at all. */
export const NoTracking: Story = {
  name: "No Tracking",
  args: { id: "cut-over" },
  parameters: { paneWidth: wide },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("heading", { name: "Tracking" }),
    ).toBeNull();
    await expect(
      canvas.getByRole("heading", { name: "Links" }),
    ).toBeInTheDocument();
  },
};
