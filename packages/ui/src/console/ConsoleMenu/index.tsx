import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { ConsoleIcon } from "../ConsoleIcon";
import type { ConsoleIconName } from "../sections";

/** One entry in a console menu. */
export interface MenuItem {
  label: string;
  /** Called when the entry is picked. The menu closes first. */
  onSelect?(): void;
  /** Shown but not pickable, with `hint` saying why. */
  disabled?: boolean;
  hint?: string;
  /** A line above the entry, to start a group. */
  divider?: boolean;
  /** A tickable entry, as in a filter: on or off. */
  checked?: boolean;
}

export interface ConsoleMenuProps {
  /** The button's visible word: "Actions", "Filter", "Move". */
  label: string;
  /** What the menu acts on, for its accessible name: "Actions for <task>". */
  name: string;
  items: readonly MenuItem[];
  /** A line under the entries, such as why some are off. */
  footer?: string;
  /** Extra class for the button, for where it sits. */
  buttonClassName?: string;
  /** Draw this icon instead of the word; the word stays the button's accessible name. */
  icon?: ConsoleIconName;
}

/**
 * A button that opens a menu below it, or above when there is no room.
 * Focus moves to the first entry; arrow keys, Home and End move between
 * entries; Escape and Tab close it and return focus to the button; a click
 * outside closes it. Tickable entries are `menuitemcheckbox`.
 */
export function ConsoleMenu({
  label,
  name,
  items,
  footer,
  buttonClassName,
  icon,
}: ConsoleMenuProps) {
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
    const b = button.current.getBoundingClientRect();
    const m = menu.current.getBoundingClientRect();
    const below = b.bottom + 4 + m.height <= window.innerHeight;
    setPlace({
      left: Math.max(
        8,
        Math.min(b.right - m.width, window.innerWidth - m.width - 8),
      ),
      top: below ? b.bottom + 4 : Math.max(8, b.top - 4 - m.height),
    });
    menu.current
      .querySelector<HTMLButtonElement>('button:not([aria-disabled="true"])')
      ?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target))
        close(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = [
      ...(menu.current?.querySelectorAll<HTMLButtonElement>(
        'button:not([aria-disabled="true"])',
      ) ?? []),
    ];
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      event.key === "ArrowDown"
        ? (at + 1) % entries.length
        : event.key === "ArrowUp"
          ? (at - 1 + entries.length) % entries.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? entries.length - 1
              : -1;
    if (to >= 0 && entries.length) {
      event.preventDefault();
      entries[to]?.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close(true);
    }
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`console-menu-button ${buttonClassName ?? ""}`.trim()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} for ${name}`}
        title={icon ? label : undefined}
        onClick={() => setOpen((was) => !was)}
      >
        {icon ? <ConsoleIcon name={icon} /> : label}
      </button>
      {open ? (
        <div
          ref={menu}
          className="console-menu"
          role="menu"
          aria-label={`${label} for ${name}`}
          style={place}
          onKeyDown={onKey}
        >
          {items.map((item) => (
            <div key={item.label} role="none">
              {item.divider ? <hr /> : null}
              <button
                type="button"
                role={
                  item.checked === undefined ? "menuitem" : "menuitemcheckbox"
                }
                aria-checked={item.checked}
                aria-disabled={item.disabled || undefined}
                title={item.hint}
                onClick={() => {
                  if (item.disabled) return;
                  close(true);
                  item.onSelect?.();
                }}
              >
                {item.checked === undefined ? null : (
                  <span className="console-menu-tick" aria-hidden="true">
                    {item.checked ? "✓" : ""}
                  </span>
                )}
                {item.label}
              </button>
            </div>
          ))}
          {footer ? <p className="console-menu-footer">{footer}</p> : null}
        </div>
      ) : null}
    </>
  );
}
