import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { TriageView } from ".";
import { exampleClients } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";
import { STORY_TODAY } from "../stories/worklist";
import type { WorkItem } from "../worklist/model";

const ungraded: WorkItem[] = [
  {
    ref: "db:11",
    title: "Spike: offline mode for site visits",
    customer: "halcyon",
    band: "unscheduled",
    priority: "medium",
  },
  {
    ref: "db:12",
    title: "Book the accountant",
    customer: "ashgrove",
    band: "today",
    day: STORY_TODAY,
    priority: "low",
  },
  {
    ref: "db:13",
    title: "Renew the depot certificates",
    customer: "kestrel",
    band: "tomorrow",
    day: "2026-03-13",
    key: "KF-330",
  },
];

const clientOf = (key: string) =>
  exampleClients.find((c) => c.key === key) ?? {
    name: "Other",
    colour: "var(--client-other)",
  };

const meta = {
  title: "Sidebar/Planning/Triage",
  component: TriageView,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    items: ungraded,
    sizing: {
      "11": {
        value: "medium",
        effort: "M",
        reason: "Needed before the pilot sites go offline-first",
      },
      "13": {
        value: "high",
        effort: "S",
        flag: "check the deadline",
        reason: "Certificates expire in three weeks",
      },
    },
    clientOf,
    clientOrder: exampleClients.map((c) => c.key),
    today: STORY_TODAY,
    onSave: fn(),
    busy: false,
    onClose: fn(),
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals} width={760}>
      <TriageView {...args} />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof TriageView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Suggested tasks first, ticked unless flagged; choosing both value and
 * effort ticks a task. Save takes only ticked tasks with both.
 */
export const Suggestions: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const boxes = canvas.getAllByRole("checkbox");
    await expect(boxes[0]).toBeChecked();
    await expect(boxes[1]).not.toBeChecked();
    await expect(
      canvas.getByRole("button", { name: "Save 1 grade" }),
    ).toBeEnabled();
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: /business value for book/i }),
      "low",
    );
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: /effort for book/i }),
      "XS",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Save 2 grades" }),
    );
    await expect(args.onSave).toHaveBeenCalledWith([
      { ref: "db:11", value: "medium", effort: "M" },
      { ref: "db:12", value: "low", effort: "XS" },
    ]);
  },
};

/** After saving: what happened, and what is left. */
export const Saved: Story = {
  args: { note: "Graded 2; 1 skipped (claimed).", items: [ungraded[2]!] },
};

/** Nothing left to grade. */
export const Empty: Story = {
  args: { items: [] },
};
