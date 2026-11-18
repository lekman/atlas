import { useEffect, useRef } from "react";

export interface ScopeChoice {
  /** The system's client key. */
  system: string;
  /** The name it is shown by. */
  name: string;
  /** Open tasks it has in the range shown, for the reader's bearings. */
  count: number;
}

export interface ScopeSheetProps {
  /** Every system the reader can narrow to, in order. */
  systems: readonly ScopeChoice[];
  /** The system the lists are narrowed to now, or null for all. */
  scope: string | null;
  /** Open tasks across all systems in the range shown. */
  total: number;
  /** Called with the system picked, or null for all systems. */
  onPick(system: string | null): void;
  /** Called when the reader closes the sheet without picking. */
  onCancel(): void;
}

/**
 * A sheet along the bottom for picking the system the lists are narrowed
 * to: All systems first, then each system with its open tasks. A modal
 * dialog: focus starts on the current choice, and Escape closes it.
 */
export function ScopeSheet({
  systems,
  scope,
  total,
  onPick,
  onCancel,
}: ScopeSheetProps) {
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    current.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onCancel]);
  const choice = (system: string | null, name: string, count: number) => (
    <button
      key={system ?? "all"}
      ref={system === scope ? current : undefined}
      type="button"
      className="console-sheet-choice console-scope-choice"
      aria-pressed={system === scope}
      onClick={() => onPick(system)}
    >
      <span>{name}</span>
      <span className="console-group-count">{count}</span>
    </button>
  );
  return (
    <div className="console-sheet-backdrop" onClick={onCancel}>
      <div
        className="console-sheet console-sheet-tall"
        role="dialog"
        aria-modal="true"
        aria-labelledby="console-scope-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="console-scope-title" className="console-sheet-title">
          Show one system
        </h2>
        {choice(null, "All systems", total)}
        {systems.map((s) => choice(s.system, s.name, s.count))}
        <button
          type="button"
          className="console-sheet-cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
