import type { Lighting } from "@atlas/worlds/looks";
import type { ReactNode } from "react";

import { worldFrameStyle, type SidebarWorldId } from "../theme/worlds";

import "../sidebar.css";

export type SidebarTheme = "auto" | "light" | "dark";

export interface SidebarFrameProps {
  /** `auto` follows the device's light or dark setting. */
  theme?: SidebarTheme;
  /** At least the window's height, for the whole page; off for a part shown alone. */
  fill?: boolean;
  /**
   * A world's look, as the full page has it: its colours, faces and
   * background, by day or by night. Without one, the neutral theme.
   */
  world?: { id: SidebarWorldId; lighting: Lighting };
  children: ReactNode;
}

/** The sidebar's page: its colours, type and spacing around everything in it. */
export function SidebarFrame({
  theme = "auto",
  fill = false,
  world,
  children,
}: SidebarFrameProps) {
  return (
    <div
      className={fill ? "atlas-sidebar fill" : "atlas-sidebar"}
      data-theme={world || theme === "auto" ? undefined : theme}
      data-world={world?.id}
      data-lighting={world?.lighting}
      style={world ? worldFrameStyle(world.id, world.lighting) : undefined}
    >
      <div className="wrap">{children}</div>
    </div>
  );
}
