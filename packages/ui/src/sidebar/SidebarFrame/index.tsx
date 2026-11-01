import type { ReactNode } from "react";

import "../sidebar.css";

export type SidebarTheme = "auto" | "light" | "dark";

export interface SidebarFrameProps {
  /** `auto` follows the device's light or dark setting. */
  theme?: SidebarTheme;
  children: ReactNode;
}

/** The sidebar's page: its colours, type and spacing around everything in it. */
export function SidebarFrame({ theme = "auto", children }: SidebarFrameProps) {
  return (
    <div
      className="atlas-sidebar"
      data-theme={theme === "auto" ? undefined : theme}
    >
      <div className="wrap">{children}</div>
    </div>
  );
}
