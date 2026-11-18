/** A console part shown alone, in the console's look, at a given width. */
import type { ReactNode } from "react";

import "../console.css";
import "../fonts";

export function ConsoleComponentFrame({
  width = 402,
  children,
}: {
  width?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="atlas-console"
      style={{ width, height: "auto", padding: 16, transform: "translateZ(0)" }}
    >
      {children}
    </div>
  );
}
