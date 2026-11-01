import type { ReactNode } from "react";

export interface NoteProps {
  /** `err` a failure, `warn` stale or partial data, `info` anything else. */
  tone?: "info" | "warn" | "err";
  children: ReactNode;
  /** Shows a close button; the parent hides the note. */
  onClose?: () => void;
}

/**
 * A line above a panel's content: an error, a warning about stale data, or
 * a hint. An error is announced to screen readers as it appears.
 */
export function Note({ tone = "info", children, onClose }: NoteProps) {
  const className = [
    "note",
    tone === "info" ? "" : tone,
    onClose ? "closable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={className} role={tone === "err" ? "alert" : undefined}>
      {onClose ? <span>{children}</span> : children}
      {onClose && (
        <button
          type="button"
          className="nx"
          aria-label="Dismiss"
          onClick={onClose}
        >
          ×
        </button>
      )}
    </div>
  );
}
