/**
 * The live map alone, for world stories: one kind of event at a time, so a
 * world's treatment of each event can be judged on its own.
 */
import type { AtlasEvent } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";
import {
  defaultSoundSettings,
  worlds,
  type Lighting,
  type WorldId,
} from "@atlas/worlds";
import { useEffect, useState } from "react";

import { worldStyle } from "../theme";
import { useAtlasMap } from "../useAtlasMap";
import { WorldCanvas } from "../components/WorldCanvas";

export function WorldDemonstration({
  world,
  events,
  detail,
  lighting = "day",
}: {
  world: WorldId;
  events: AtlasEvent[];
  detail: "compact" | "full";
  lighting?: Lighting;
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
      data-lighting={lighting}
      style={{
        ...worldStyle(definition, lighting),
        position: "relative",
        height: "100vh",
      }}
    >
      <WorldCanvas
        scene={map.scene}
        world={definition}
        detail={detail}
        lighting={lighting}
        selectedId={selected}
        onSelect={setSelected}
        label={`${definition.name} map of the sample dataset`}
      />
    </div>
  );
}

/** One event of each kind, on records in the sample dataset. */
export const sampleEvents = {
  message: {
    type: "agent-message",
    from: "schema",
    to: "gaps-watch",
    text: "Hold staging releases while I rehearse",
  },
  outside: {
    type: "external",
    source: "github",
    recordId: "database-tests",
    text: "Pull request 366: checks passed",
  },
  waiting: {
    type: "status-change",
    agentId: "tracking",
    to: "waiting",
    text: "Needs your call on a failing test",
  },
  answered: {
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
  },
} satisfies Record<string, AtlasEvent>;
