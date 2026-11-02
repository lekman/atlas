import type { CSSProperties } from "react";

export interface GroupHeaderProps {
  label: string;
  count: number;
  /** Shown instead of the bare count: "3 open · 1 done". */
  countText?: string;
  /** The label's colour, a CSS value. */
  colour: string;
  /** With a toggle, the header folds its group; it remembers nothing itself. */
  open?: boolean;
  onToggle?: () => void;
  /** The toggle's tooltip. */
  title?: string;
}

/**
 * The small capitals over a group of rows, with the count. With `onToggle`
 * it is a button that folds the group.
 */
export function GroupHeader({
  label,
  count,
  countText,
  colour,
  open = true,
  onToggle,
  title,
}: GroupHeaderProps) {
  const style = { "--c": colour } as CSSProperties;
  const counted = <span>{countText ?? count}</span>;
  if (!onToggle) {
    return (
      <div className="grp" style={style}>
        {label}
        {counted}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="grp"
      style={style}
      aria-expanded={open}
      title={title}
      onClick={onToggle}
    >
      <span className="nm">
        <i className="chev" aria-hidden="true" />
        {label}
      </span>
      {counted}
    </button>
  );
}
