import type { ReactNode } from "react";

import { formatToday } from "../format";
import { syncLabel, type SyncState } from "../sync";

export interface SidebarHeaderProps {
  now: Date;
  sync: SyncState;
  /** Buttons in place of the sync state: sound and settings. */
  controls?: ReactNode;
}

/** The title, today's date and how fresh the worklist is. */
export function SidebarHeader({ now, sync, controls }: SidebarHeaderProps) {
  const label = syncLabel(sync, now);
  return (
    <header className="top">
      <h1>
        Atlas <small>{formatToday(now)}</small>
      </h1>
      {controls ?? (
        <div className="meta">
          <span
            className={label.tone === "err" ? "sync err" : "sync"}
            title={label.title}
          >
            {label.text}
          </span>
        </div>
      )}
    </header>
  );
}
