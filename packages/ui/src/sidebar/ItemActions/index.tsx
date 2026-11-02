import { useState } from "react";

import { Icon } from "../Icon";
import type { IconName } from "../icons";

export interface ItemAction {
  icon: IconName;
  label: string;
  onSelect: () => void;
  primary?: boolean;
  disabled?: boolean;
  /** Why it is disabled, added to its label. */
  why?: string;
}

export interface ItemActionsProps {
  /** Groups of actions, with a divider between groups. */
  groups: ReadonlyArray<readonly ItemAction[]>;
}

/**
 * A task's actions in its details, as icon buttons. Each button's label is
 * its name for screen readers and its tooltip; on a touch screen, which
 * has no hover, it shows under the bar while a finger is on the button.
 */
export function ItemActions({ groups }: ItemActionsProps) {
  const [hint, setHint] = useState("");
  return (
    <div>
      <div className="dacts" role="group" aria-label="Item actions">
        {groups
          .filter((g) => g.length)
          .map((group, i) => (
            <span key={group[0]!.label} className="dgroup">
              {i > 0 && <span className="sep" aria-hidden="true" />}
              {group.map((a) => {
                const title =
                  a.disabled && a.why ? `${a.label}: ${a.why}` : a.label;
                return (
                  <button
                    key={a.label}
                    type="button"
                    className={a.primary ? "dicon primary" : "dicon"}
                    aria-label={title}
                    aria-disabled={a.disabled || undefined}
                    title={title}
                    onPointerEnter={() => setHint(title)}
                    onPointerLeave={() => setHint("")}
                    onClick={() => {
                      if (!a.disabled) a.onSelect();
                    }}
                  >
                    <Icon name={a.icon} />
                  </button>
                );
              })}
            </span>
          ))}
      </div>
      <div className="dhint" aria-hidden="true">
        {hint}
      </div>
    </div>
  );
}
