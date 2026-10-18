/** A world's colours and faces around a single component, for its stories. */
import { worlds, type WorldId } from "@atlas/worlds";
import type { ReactNode } from "react";

import { worldStyle } from "../theme";

export function WorldFrame({
  world,
  children,
  width = 380,
}: {
  world: WorldId;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      className="atlas"
      data-world={world}
      data-mode="story"
      style={{
        ...worldStyle(worlds[world]),
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

/** The world chosen in the Storybook toolbar. */
export function storyWorld(globals: Record<string, unknown>): WorldId {
  return globals.world === "mariner" ? "mariner" : "astronomer";
}
