import type { AtlasEvent } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import { defaultSoundSettings, worlds, type WorldId } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { worldStyle } from "./theme";
import { useAtlasMap } from "./useAtlasMap";
import { WorldCanvas } from "./WorldCanvas";

/**
 * The live map alone, one kind of event at a time, so each world's
 * treatment of an event can be judged on its own.
 */
function Demonstration({
  world,
  events,
  detail,
}: {
  world: WorldId;
  events: AtlasEvent[];
  detail: "compact" | "full";
}) {
  const definition = worlds[world];
  const map = useAtlasMap({
    dataset: sampleDataset,
    world: definition,
    sound: defaultSoundSettings,
  });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (events.length === 0) return;
    let index = 0;
    const timer = window.setInterval(() => {
      const event = events[index % events.length];
      index++;
      if (event) map.fire(event);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [events, map.fire]);
  return (
    <div
      className="atlas"
      data-world={world}
      data-mode="full"
      style={{
        ...worldStyle(definition),
        position: "relative",
        height: "100vh",
      }}
    >
      <WorldCanvas
        scene={map.scene}
        world={definition}
        detail={detail}
        selectedId={selected}
        onSelect={setSelected}
        label={`${definition.name} map of the sample dataset`}
      />
    </div>
  );
}

const meta = {
  title: "Worlds/World Canvas",
  component: Demonstration,
  parameters: { layout: "fullscreen" },
  args: { world: "astronomer", events: [], detail: "full" },
  argTypes: {
    world: { control: "inline-radio", options: ["astronomer", "mariner"] },
    detail: { control: "inline-radio", options: ["compact", "full"] },
  },
} satisfies Meta<typeof Demonstration>;

export default meta;
type Story = StoryObj<typeof meta>;

const message: AtlasEvent = {
  type: "agent-message",
  from: "schema",
  to: "gaps-watch",
  text: "Hold staging releases while I rehearse",
};
const outside: AtlasEvent = {
  type: "external",
  source: "github",
  recordId: "database-tests",
  text: "Pull request 366: checks passed",
};
const waiting: AtlasEvent = {
  type: "status-change",
  agentId: "tracking",
  to: "waiting",
  text: "Needs your call on a failing test",
};
const answered: AtlasEvent = {
  type: "question-answered",
  questionId: "drill-window",
  answer: "Saturday at 10:00",
  decision: {
    id: "drill-saturday",
    clientId: "halcyon",
    title: "Drill on Saturday at 10:00",
    decides: "weekend-drill",
    state: "made",
    classification: "client-confidential",
    boundary: "home-server",
  },
};

export const Astronomer: Story = { args: { world: "astronomer" } };
export const Mariner: Story = { args: { world: "mariner" } };
export const AstronomerCompact: Story = {
  name: "Astronomer, Compact",
  args: { world: "astronomer", detail: "compact" },
};
export const MarinerCompact: Story = {
  name: "Mariner, Compact",
  args: { world: "mariner", detail: "compact" },
};
export const MessageBetweenAgents: Story = {
  name: "Message Between Agents",
  args: { events: [message] },
};
export const EventFromOutside: Story = {
  name: "Event from Outside",
  args: { events: [outside] },
};
export const AgentStartsWaiting: Story = {
  name: "Agent Starts Waiting",
  args: { world: "mariner", events: [waiting] },
};
export const QuestionAnswered: Story = {
  name: "Question Answered",
  args: { world: "mariner", events: [answered] },
};
