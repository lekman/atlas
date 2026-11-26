import { ConsoleIcon } from "../ConsoleIcon";
import type { RailSide } from "../layout";
import { railSections, sectionNames, type Section } from "../sections";

export interface SectionRailProps {
  /** The section shown now. */
  current: Section;
  /** Which screen edge the menu is on. */
  side: RailSide;
  /** A count beside a section, such as the beams waiting. Zero or absent shows none. */
  counts?: Partial<Record<Section, number>>;
  /** Whether the settings screen is open. */
  settingsOpen?: boolean;
  /** Called with the section the reader picks. */
  onSelect(section: Section): void;
  /** Called when the reader opens settings. */
  onSettings(): void;
  /** Whether sound is on, for the sound button above settings. */
  soundOn?: boolean;
  /** Turns sound on or off. Leave out to show no sound button. */
  onSound?(): void;
}

/**
 * The menu along the bottom, or down the left or right edge, as chosen in
 * Settings. The sections sit in the middle where a thumb reaches them, and
 * sound on or off and settings sit at the end. Every button is at least
 * 44 px high, and each section keeps its word under the icon where there
 * is room, so the menu reads without knowing the icons.
 */
export function SectionRail({
  current,
  side,
  counts = {},
  settingsOpen = false,
  onSelect,
  onSettings,
  soundOn = false,
  onSound,
}: SectionRailProps) {
  return (
    <nav className="console-rail" aria-label="Sections" data-side={side}>
      <ul className="console-rail-sections">
        {railSections.map((section) => {
          const count = counts[section] ?? 0;
          return (
            <li key={section}>
              <button
                type="button"
                className="console-rail-button console-rail-section"
                aria-current={
                  section === current && !settingsOpen ? "page" : undefined
                }
                onClick={() => onSelect(section)}
              >
                <ConsoleIcon name={section} />
                <span className="console-rail-word">
                  {sectionNames[section]}
                </span>
                {count > 0 ? (
                  <span className="console-rail-count">
                    {count}
                    <span className="console-visually-hidden"> waiting</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {onSound ? (
        <button
          type="button"
          className="console-rail-button console-rail-sound"
          aria-label="Sound"
          aria-pressed={soundOn}
          title={soundOn ? "Sound on" : "Sound off"}
          onClick={onSound}
        >
          <ConsoleIcon name={soundOn ? "sound" : "muted"} />
        </button>
      ) : null}
      <button
        type="button"
        className="console-rail-button console-rail-settings"
        aria-label="Settings"
        aria-current={settingsOpen ? "page" : undefined}
        onClick={onSettings}
      >
        <ConsoleIcon name="settings" />
      </button>
    </nav>
  );
}
