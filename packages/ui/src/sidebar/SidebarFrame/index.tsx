import type { ReactNode } from "react";

import "../sidebar.css";

export type SidebarTheme = "auto" | "light" | "dark";

export interface SidebarFrameProps {
  /** `auto` follows the device's light or dark setting. */
  theme?: SidebarTheme;
  /** At least the window's height, for the whole page; off for a part shown alone. */
  fill?: boolean;
  children: ReactNode;
}

/** The sidebar's page: its colours, type and spacing around everything in it. */
export function SidebarFrame({
  theme = "auto",
  fill = false,
  children,
}: SidebarFrameProps) {
  return (
    <div
      className={fill ? "atlas-sidebar fill" : "atlas-sidebar"}
      data-theme={theme === "auto" ? undefined : theme}
    >
      <div className="wrap">{children}</div>
    </div>
  );
}
