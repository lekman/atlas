import { plannedWorlds, worldIds, worlds, type WorldId } from "@atlas/worlds";

export interface WorldPickerProps {
  /** The world in use, marked as current. */
  current: WorldId;
  /** A world was picked. The parent switches; the picker changes nothing. */
  onChange(id: WorldId): void;
}

/**
 * Every built world, then any planned ones, greyed out. The description
 * says what the metaphor is before anyone commits to it.
 */
export function WorldPicker({ current, onChange }: WorldPickerProps) {
  return (
    <div className="atlas-panel" role="dialog" aria-label="Choose a world">
      <h2 className="atlas-panel-title">World</h2>
      <ul className="atlas-worlds">
        {worldIds.map((id) => {
          const world = worlds[id];
          return (
            <li key={id}>
              <button
                type="button"
                className="atlas-world"
                aria-current={id === current}
                onClick={() => onChange(id)}
              >
                <strong>{world.name}</strong>
                <em>{id === current ? "in use" : ""}</em>
                <span>{world.description}</span>
              </button>
            </li>
          );
        })}
        {plannedWorlds.map((planned) => (
          <li key={planned.id}>
            <button type="button" className="atlas-world" disabled>
              <strong>{planned.name}</strong>
              <em>planned</em>
              <span>
                {planned.description} Home is {planned.homeName}.
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
