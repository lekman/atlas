import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { ConsoleIcon } from "../ConsoleIcon";
import {
  layoutFor,
  rememberedRailSide,
  type ConsoleLayout,
  type RailSide,
} from "../layout";
import { SectionRail } from "../SectionRail";
import type { Section } from "../sections";
import { TopBar, type TopBarProps } from "../TopBar";

import "../console.css";

export interface ConsoleFrameProps extends Omit<TopBarProps, "compact"> {
  /** The section shown now. */
  section: Section;
  /** Counts beside sections in the rail, such as beams waiting. */
  counts?: Partial<Record<Section, number>>;
  /** Whether the settings screen fills the panes. */
  settingsOpen?: boolean;
  /** The menu's edge, as chosen in Settings; the remembered one, or the bottom, when left out. */
  railSide?: RailSide;
  /** The section's list. */
  list: ReactNode;
  /** The list fills both panes and the detail is not shown, as the Map does. */
  wide?: boolean;
  /** The selected item, or null when nothing is selected. */
  detail: ReactNode | null;
  /** The settings screen, shown across both panes while it is open. */
  settings?: ReactNode;
  /** Shown in the item pane when nothing is selected, where there is a second pane. */
  emptyDetail?: ReactNode;
  /** A sheet or dialog shown over the panes, such as the move sheet. */
  overlay?: ReactNode;
  /** The width to lay out for before the frame has measured itself. */
  initialWidth?: number;
  /** Called with the section the reader picks. */
  onSelectSection(section: Section): void;
  /** Called when the reader leaves an item on a one-pane screen. */
  onBack(): void;
  /** Whether sound is on, for the rail's sound button. */
  soundOn?: boolean;
  /** Turns sound on or off from the rail. Leave out to show no sound button. */
  onSound?(): void;
  /** Called when the reader opens or closes settings. */
  onSettings(): void;
}

/**
 * The console: the top bar, the rail on one edge, and a list and detail.
 *
 * It measures its own width rather than the screen's, so it lays out the
 * same in the sidebar beside an artifact, on a folding phone open or closed,
 * and on a laptop (see `layout.ts`). On one pane the selected item replaces
 * the list and offers a back link; on two, the list stays and the item
 * opens beside it. The rail's side is the reader's, kept per layout, since
 * a thumb and two hands want different edges. Each pane scrolls on its own
 * and can take focus, so it scrolls from the keyboard too.
 */
export function ConsoleFrame({
  section,
  counts,
  settingsOpen = false,
  railSide,
  list,
  wide = false,
  detail,
  settings,
  emptyDetail,
  overlay,
  initialWidth = 420,
  onSelectSection,
  onBack,
  onSettings,
  soundOn = false,
  onSound,
  ...topBar
}: ConsoleFrameProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initialWidth);
  const layout: ConsoleLayout = layoutFor(width);
  const side = railSide ?? rememberedRailSide();

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  let panes: ReactNode;
  if (settingsOpen && settings)
    panes = (
      <section
        className="console-pane console-pane-whole"
        aria-label="Settings"
        tabIndex={0}
      >
        {settings}
      </section>
    );
  else if (wide)
    panes = (
      <section
        className="console-pane console-pane-whole console-pane-wide"
        aria-label="Map"
      >
        {list}
      </section>
    );
  else if (layout === "single")
    panes = (
      <section
        className="console-pane console-pane-whole"
        aria-label={detail ? "Detail" : "List"}
        tabIndex={0}
      >
        {detail ? (
          <>
            <button type="button" className="console-back" onClick={onBack}>
              <ConsoleIcon name="back" />
              Back
            </button>
            {detail}
          </>
        ) : (
          list
        )}
      </section>
    );
  else
    panes = (
      <>
        <section
          className="console-pane console-pane-list"
          aria-label="List"
          tabIndex={0}
        >
          {list}
        </section>
        <section
          className="console-pane console-pane-detail"
          aria-label="Detail"
          tabIndex={0}
        >
          {detail ?? emptyDetail ?? (
            <p className="console-empty">Select an item to see it here.</p>
          )}
        </section>
      </>
    );

  return (
    <div
      ref={frame}
      className="atlas-console"
      data-layout={layout}
      data-rail={side}
    >
      <TopBar {...topBar} compact={width < 440} />
      <div className="console-body">
        <SectionRail
          current={section}
          side={side}
          {...(counts ? { counts } : {})}
          settingsOpen={settingsOpen}
          onSelect={onSelectSection}
          onSettings={onSettings}
          soundOn={soundOn}
          {...(onSound ? { onSound } : {})}
        />
        <main className="console-panes">{panes}</main>
      </div>
      {overlay}
    </div>
  );
}
