import type { ReactNode } from "react";

export interface SectionHeadingProps {
  /** The section's or the screen's name. */
  title: string;
  /** The system the lists are narrowed to, or null for all systems. */
  scope?: string | null;
  /** Called when the reader opens the scope picker. Without it there is no scope button, as on Shields. */
  onScope?(): void;
  /** Controls after the scope button, such as a view switch. */
  children?: ReactNode;
}

/**
 * The heading at the top of every list: its name and the scope button.
 * Picking a system on the map or with this button narrows Radar, Missions,
 * Agents, Beam and Log to it, so the button always says which.
 */
export function SectionHeading({
  title,
  scope = null,
  onScope,
  children,
}: SectionHeadingProps) {
  return (
    <div className="console-heading">
      <h1>{title}</h1>
      {onScope ? (
        <button
          type="button"
          className="console-chip"
          aria-label={`Scope: ${scope ?? "All systems"}. Change`}
          onClick={onScope}
        >
          {scope ?? "All systems"}
        </button>
      ) : null}
      {children}
    </div>
  );
}
