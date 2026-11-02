import type { CSSProperties, ReactNode } from "react";

export interface BadgeProps {
  /** The dark left half: a word or a logo. */
  label: ReactNode;
  /** The coloured right half. */
  value: string;
  /** The right half's colour and its text colour, as CSS values. */
  colour: string;
  ink?: string;
  /** Makes the badge a link, opening in a new tab. */
  href?: string | null;
  title?: string;
  /** Makes the badge a button; `expanded` is what it opens. */
  onClick?: () => void;
  expanded?: boolean;
}

/** A two-part badge, as on a README: what it is, and its state in colour. */
export function Badge({
  label,
  value,
  colour,
  ink = "#ffffff",
  href,
  title,
  onClick,
  expanded,
}: BadgeProps) {
  const style = { "--c": colour, "--fg": ink } as CSSProperties;
  const parts = (
    <>
      <span className="l">{label}</span>
      <span className="r">{value}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className="bdg"
        style={style}
        title={title}
        aria-expanded={expanded}
        onClick={onClick}
      >
        {parts}
      </button>
    );
  }
  return href ? (
    <a
      className="bdg"
      style={style}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
    >
      {parts}
    </a>
  ) : (
    <span className="bdg" style={style} title={title}>
      {parts}
    </span>
  );
}
