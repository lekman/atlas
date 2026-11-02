import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { Icon } from "../Icon";
import type { IconName } from "../icons";

export interface MenuAction {
  label: string;
  /** An icon before the label. */
  icon?: IconName;
  onSelect?: () => void;
  /** Shown, but not chosen. */
  disabled?: boolean;
  /** A line under the action that explains it. */
  hint?: string;
  /** A divider before this action, starting a new group. */
  divider?: boolean;
}

export interface ActionMenuProps {
  /** What the menu acts on, for its label: "Actions for <what>". */
  what: string;
  actions: readonly MenuAction[];
  /** A line at the end of the menu, about all of it. */
  footer?: string;
}

/**
 * A ⋯ button that opens a menu of actions under it, kept inside the
 * window. Arrow keys, Home and End move between actions; Escape closes the
 * menu and returns to the button.
 */
export function ActionMenu({ what, actions, footer }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !button.current || !menu.current) return;
    const r = button.current.getBoundingClientRect();
    const m = menu.current.getBoundingClientRect();
    const below = r.bottom + 4 + m.height <= window.innerHeight - 8;
    setPlace({
      left: Math.max(
        8,
        Math.min(window.innerWidth - m.width - 8, r.right - m.width),
      ),
      top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - m.height),
    });
    menu.current
      .querySelector<HTMLButtonElement>('button:not([aria-disabled="true"])')
      ?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target))
        close(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...(menu.current?.querySelectorAll<HTMLButtonElement>(
        'button:not([aria-disabled="true"])',
      ) ?? []),
    ];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      e.key === "ArrowDown"
        ? (at + 1) % items.length
        : e.key === "ArrowUp"
          ? (at - 1 + items.length) % items.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : -1;
    if (to >= 0 && items.length) {
      e.preventDefault();
      items[to]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      close(true);
    }
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="kebab"
        aria-label={`Actions for ${what}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        ⋯
      </button>
      {open && (
        <div
          ref={menu}
          className="menu"
          role="menu"
          aria-label={`Actions for ${what}`}
          style={place}
          onKeyDown={onKey}
        >
          {actions.map((a) => (
            <div key={a.label} role="none">
              {a.divider && <hr />}
              <button
                type="button"
                role="menuitem"
                className={a.icon ? "mcopy" : undefined}
                aria-disabled={a.disabled || undefined}
                title={a.hint}
                onClick={() => {
                  if (a.disabled) return;
                  close(true);
                  a.onSelect?.();
                }}
              >
                {a.icon && (
                  <span className="ico" aria-hidden="true">
                    <Icon name={a.icon} />
                  </span>
                )}
                {a.label}
              </button>
              {a.hint && <div className="hint">{a.hint}</div>}
            </div>
          ))}
          {footer && <div className="hint">{footer}</div>}
        </div>
      )}
    </>
  );
}
