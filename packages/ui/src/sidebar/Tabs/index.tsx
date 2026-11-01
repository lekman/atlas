import { useRef, type KeyboardEvent, type ReactNode } from "react";

import type { IconName, LogoName } from "../icons";
import { Icon, Logo } from "../Icon";

export interface SidebarTabItem {
  id: string;
  label: string;
  icon?: IconName;
  logo?: LogoName;
  /** Shown after the label: a count, or "✓". */
  count?: string;
  /** `warn` yellow, `crit` red: host alerts. */
  tone?: "warn" | "crit";
  /** Pushed to the far end of the row. */
  end?: boolean;
  /** Only the icon shows; the label is the tooltip and the accessible name. */
  iconOnly?: boolean;
}

export interface TabsProps {
  /** What the row of tabs is, for screen readers. */
  label: string;
  /** Prefixes the tab and panel ids, which must be unique on the page. */
  idPrefix: string;
  tabs: readonly SidebarTabItem[];
  selected: string;
  onSelect: (id: string) => void;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-view-${id}`;

/**
 * The sidebar's views as tabs. Arrow keys, Home and End move between tabs
 * and open the one they land on; only the open tab is in the Tab order.
 */
export function Tabs({ label, idPrefix, tabs, selected, onSelect }: TabsProps) {
  const row = useRef<HTMLDivElement>(null);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = tabs.length;
    const at = tabs.findIndex((t) => t.id === selected);
    const to =
      e.key === "ArrowRight"
        ? (at + 1) % n
        : e.key === "ArrowLeft"
          ? (at + n - 1) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    const next = tabs[to];
    if (!next) return;
    e.preventDefault();
    onSelect(next.id);
    row.current
      ?.querySelector<HTMLButtonElement>(
        `#${CSS.escape(tabId(idPrefix, next.id))}`,
      )
      ?.focus();
  };

  return (
    <div
      ref={row}
      className="tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={onKey}
    >
      {tabs.map((t) => {
        const on = t.id === selected;
        const className = ["tab", t.tone ?? "", t.end ? "end" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={t.id}
            id={tabId(idPrefix, t.id)}
            type="button"
            role="tab"
            className={className}
            aria-selected={on}
            aria-controls={panelId(idPrefix, t.id)}
            tabIndex={on ? 0 : -1}
            title={t.label}
            onClick={() => onSelect(t.id)}
          >
            {t.icon && <Icon name={t.icon} />}
            {t.logo && <Logo name={t.logo} />}
            <span className={t.iconOnly ? "sr" : undefined}>{t.label}</span>
            {t.count && <span className="n">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  idPrefix: string;
  id: string;
  selected: string;
  children: ReactNode;
}

/** The view behind a tab. Hidden ones stay mounted, so their state survives. */
export function TabPanel({ idPrefix, id, selected, children }: TabPanelProps) {
  return (
    <div
      id={panelId(idPrefix, id)}
      role="tabpanel"
      aria-labelledby={tabId(idPrefix, id)}
      hidden={id !== selected}
    >
      {children}
    </div>
  );
}
