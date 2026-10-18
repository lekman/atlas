/** A world's colours and faces around a single component, for its stories. */
import { isWorldId, worlds, type Lighting, type WorldId } from "@atlas/worlds";
import type { ReactNode } from "react";

import { worldStyle } from "../theme";

export function WorldFrame({
  world,
  children,
  width = 380,
  lighting = "day",
}: {
  world: WorldId;
  children: ReactNode;
  width?: number;
  lighting?: Lighting;
}) {
  return (
    <div
      className="atlas"
      data-world={world}
      data-mode="story"
      data-lighting={lighting}
      style={{
        ...worldStyle(worlds[world], lighting),
        minHeight: 0,
        height: "auto",
        padding: 20,
        maxWidth: width,
      }}
    >
      {children}
    </div>
  );
}

/** The lighting chosen in the Storybook toolbar. */
export function storyLighting(globals: Record<string, unknown>): Lighting {
  return globals.lighting === "night" ? "night" : "day";
}

/** The world chosen in the Storybook toolbar. */
export function storyWorld(globals: Record<string, unknown>): WorldId {
  return isWorldId(globals.world) ? globals.world : "astronomer";
}
