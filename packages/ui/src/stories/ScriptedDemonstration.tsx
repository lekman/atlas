/**
 * The live map alone, replaying a script of events in a loop, for world
 * stories that need several events in order: a launch, the work, a return.
 */
import { sampleDataset, type ScriptStep } from "@atlas/fixtures";
import {
  defaultSoundSettings,
  worlds,
  type Lighting,
  type WorldId,
} from "@atlas/worlds";
import { useState } from "react";

import { WorldCanvas } from "../components/WorldCanvas";
import { worldStyle } from "../theme";
import { useAtlasMap } from "../useAtlasMap";

export function ScriptedDemonstration({
  world,
  script,
  interval = 2.6,
  lighting = "day",
  zoomClientId,
}: {
  world: WorldId;
  /** The steps to replay. End with a reset so the loop starts clean. */
  script: ScriptStep[];
  /** Seconds between steps. */
  interval?: number;
  lighting?: Lighting;
  /** Fly in to this client's system on load, so its work reads up close. */
  zoomClientId?: string;
}) {
  const definition = worlds[world];
  const map = useAtlasMap({
    dataset: sampleDataset,
    world: definition,
    sound: defaultSoundSettings,
    script,
    interval,
  });
  const [selected, setSelected] = useState<string | null>(null);
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
        detail="full"
        lighting={lighting}
        selectedId={selected}
        onSelect={setSelected}
        zoomClientId={zoomClientId ?? null}
        label={`${definition.name} map of the sample dataset`}
      />
    </div>
  );
}
