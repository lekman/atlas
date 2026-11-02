/** A sidebar component in the sidebar's theme, at the sidebar's width. */
import type { ReactNode } from "react";

import { SidebarFrame } from "../SidebarFrame";
import type { SidebarWorldId } from "../theme/worlds";

export function SidebarStoryFrame({
  globals,
  width = 420,
  world,
  children,
}: {
  globals: Record<string, unknown>;
  width?: number;
  /** A world's look instead of the neutral theme. */
  world?: SidebarWorldId;
  children: ReactNode;
}) {
  const night = globals.lighting === "night";
  return (
    <div style={{ maxWidth: width }}>
      <SidebarFrame
        theme={night ? "dark" : "light"}
        world={
          world ? { id: world, lighting: night ? "night" : "day" } : undefined
        }
      >
        {children}
      </SidebarFrame>
    </div>
  );
}
