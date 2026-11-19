import { ConsoleIcon } from "../ConsoleIcon";
import { relayWords, type RelayState } from "../layout";

/** One of the reader's accounts, as the fleet switcher shows it. */
export interface Fleet {
  id: string;
  /** The full name, shown where there is room. */
  label: string;
  /** Three letters, shown on a narrow screen. */
  shortLabel: string;
  /** The shape the fleet's systems are drawn in, so it does not rest on colour alone. */
  mark: "diamond" | "circle";
  /** Which of the two fleet colours it takes. */
  tone: "amber" | "blue";
}

export interface TopBarProps {
  /** The reader's fleets, in the order the switcher shows them. With fewer than two there is no switcher. */
  fleets: readonly Fleet[];
  /** The fleet whose work is shown. */
  fleetId: string;
  /** Today's score so far, or null when there is none to show: the bar then leaves it out. */
  score: number | null;
  /** What the link to the Mac mini is doing. */
  relay: RelayState;
  /** Short fleet names, for a narrow screen. The full name follows for screen readers. */
  compact?: boolean;
  /** Called with the fleet the reader picks. */
  onFleetChange(fleetId: string): void;
}

/**
 * The console's top bar, 52 px high: the orbit mark and name, the fleet
 * switcher, today's score and the relay state. In the split layout its two
 * halves meet at the fold, so no control sits across the crease.
 */
export function TopBar({
  fleets,
  fleetId,
  score,
  relay,
  compact = false,
  onFleetChange,
}: TopBarProps) {
  return (
    <header className="console-top">
      <div className="console-top-start">
        <span className="console-logo">
          <ConsoleIcon name="logo" />
          <span>Atlas</span>
        </span>
        {fleets.length > 1 ? (
          <div className="console-fleets" role="group" aria-label="Fleet">
            {fleets.map((fleet) => (
              <button
                key={fleet.id}
                type="button"
                className="console-fleet"
                data-tone={fleet.tone}
                aria-pressed={fleet.id === fleetId}
                onClick={() => onFleetChange(fleet.id)}
              >
                <span
                  className="console-mark"
                  data-mark={fleet.mark}
                  aria-hidden="true"
                />
                {compact ? (
                  <>
                    {fleet.shortLabel}
                    <span className="console-visually-hidden">
                      , {fleet.label}
                    </span>
                  </>
                ) : (
                  fleet.label
                )}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="console-top-end">
        {score === null ? null : (
          <span className="console-score">
            <span className="console-label">Today</span>{" "}
            <span className="console-score-value">{score}</span>
            <span className="console-visually-hidden"> points</span>
          </span>
        )}
        <span className="console-relay" data-relay={relay.kind} role="status">
          <span className="console-relay-dot" aria-hidden="true" />
          {relayWords(relay)}
        </span>
      </div>
    </header>
  );
}
