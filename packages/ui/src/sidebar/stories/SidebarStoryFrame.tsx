/** A sidebar component in the sidebar's theme, at the sidebar's width. */
import type { ReactNode } from "react";

import { SidebarFrame } from "../SidebarFrame";

export function SidebarStoryFrame({
  globals,
  width = 420,
  children,
}: {
  globals: Record<string, unknown>;
  width?: number;
  children: ReactNode;
}) {
  return (
    <div style={{ maxWidth: width }}>
      <SidebarFrame theme={globals.lighting === "night" ? "dark" : "light"}>
        {children}
      </SidebarFrame>
    </div>
  );
}
