import type { CSSProperties } from "react";

export interface GroupHeaderProps {
  label: string;
  count: number;
  /** The label's colour, a CSS value. */
  colour: string;
  /** With a toggle, the header folds its group; it remembers nothing itself. */
  open?: boolean;
  onToggle?: () => void;
}

/**
 * The small capitals over a group of rows, with the count. With `onToggle`
 * it is a button that folds the group.
 */
export function GroupHeader({
  label,
  count,
  colour,
  open = true,
  onToggle,
}: GroupHeaderProps) {
  const style = { "--c": colour } as CSSProperties;
  if (!onToggle) {
    return (
      <div className="grp" style={style}>
        {label}
        <span>{count}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="grp"
      style={style}
      aria-expanded={open}
      onClick={onToggle}
    >
      <span className="nm">
        <i className="chev" aria-hidden="true" />
        {label}
      </span>
      <span>{count}</span>
    </button>
  );
}
