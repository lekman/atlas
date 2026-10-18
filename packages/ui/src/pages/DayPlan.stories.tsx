import { sampleDataset, sampleDayPlan } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { DayList } from "../components/DayList";
import { DetailsReader } from "../components/DetailsReader";
import { longDay } from "../dates";
import { worldStyle } from "../theme";

/**
 * The day plan as one screen in the Astronomer: the list on the left and
 * the open task's details beside it. On a phone the reader rises as a
 * sheet over the list. New screens are designed in the Astronomer first.
 */
function DayPlanPage({ initialId }: { initialId?: string }) {
  const [selectedId, setSelectedId] = useState(initialId);
  const [readerOpen, setReaderOpen] = useState(initialId !== undefined);
  const world = worlds.astronomer;
  const task = sampleDayPlan.items.find((item) => item.id === selectedId);
  const document = sampleDayPlan.documents.find(
    (candidate) => candidate.id === task?.detailsId,
  );
  const clientName =
    sampleDataset.clients.find((client) => client.id === document?.clientId)
      ?.name ?? "";
  return (
    <div
      className="atlas atlas-day-plan"
      data-world={world.id}
      data-mode="story"
      style={worldStyle(world)}
    >
      <header className="atlas-day-plan-bar">
        <h1>Day plan</h1>
        <p>{longDay(sampleDayPlan.today)}</p>
      </header>
      <div className="atlas-day-plan-columns">
        <div
          className="atlas-day-plan-list"
          tabIndex={0}
          role="region"
          aria-label="Tasks by day"
        >
          <DayList
            plan={sampleDayPlan}
            clients={sampleDataset.clients}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setReaderOpen(true);
            }}
          />
        </div>
        {readerOpen && document && (
          <div className="atlas-day-plan-reader">
            <DetailsReader
              document={document}
              world={world}
              clientName={clientName}
              today={sampleDayPlan.today}
              tracker={task?.tracker}
              onClose={() => setReaderOpen(false)}
              onOpenInObsidian={() => undefined}
              onOpenTicket={() => undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const meta = {
  title: "Pages/Day Plan",
  component: DayPlanPage,
  parameters: { layout: "fullscreen" },
  args: { initialId: "rehearse-cut-over" },
} satisfies Meta<typeof DayPlanPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Today's plan with the cut-over rehearsal's details open beside it. */
export const Astronomer: Story = {};

/** Picking another task opens its details; Close puts the list back on its own. */
export const OpeningAndClosing: Story = {
  name: "Opening and Closing",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Partner webhook retries" }),
    );
    await expect(
      canvas.getByRole("heading", {
        level: 2,
        name: "Partner webhook retries",
      }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(
      canvas.queryByRole("button", { name: "Open in Obsidian" }),
    ).not.toBeInTheDocument();
  },
};
