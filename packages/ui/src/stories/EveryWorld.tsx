/**
 * One component in every world's day palette, stacked, so a single story
 * puts each palette through the accessibility check, the light worlds too.
 */
import { worldIds, worlds, type World } from "@atlas/worlds";
import type { ReactNode } from "react";

import { WorldFrame } from "./WorldFrame";

export function EveryWorld({
  width = 420,
  children,
}: {
  width?: number;
  children: (world: World) => ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {worldIds.map((id) => (
        <WorldFrame key={id} world={id} width={width}>
          <p className="atlas-eyebrow" style={{ marginBottom: 10 }}>
            {worlds[id].name}
          </p>
          {children(worlds[id])}
        </WorldFrame>
      ))}
    </div>
  );
}
