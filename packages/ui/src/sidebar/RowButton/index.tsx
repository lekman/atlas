import { Icon } from "../Icon";
import type { IconName } from "../icons";

export interface RowButtonProps {
  icon: IconName;
  /** Its name for screen readers, and its tooltip unless `title` says more. */
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
}

/** A small icon button at the end of a tracker row. */
export function RowButton({
  icon,
  label,
  title,
  onClick,
  disabled,
}: RowButtonProps) {
  return (
    <button
      type="button"
      className="rowbtn"
      aria-label={label}
      title={title ?? label}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      <Icon name={icon} />
    </button>
  );
}
