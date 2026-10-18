import {
  describeNight,
  lightingPreferences,
  plannedWorlds,
  worldIds,
  worlds,
  type LightingPreference,
  type WorldId,
} from "@atlas/worlds";

export interface WorldPickerProps {
  /** The world in use, marked as current. */
  current: WorldId;
  /** A world was picked. The parent switches; the picker changes nothing. */
  onChange(id: WorldId): void;
  /** Day, night, or follow the device. Leave out to hide the choice. */
  lighting?: LightingPreference;
  /** A lighting was picked. */
  onLightingChange?(lighting: LightingPreference): void;
}

const lightingNames: Record<LightingPreference, string> = {
  automatic: "Automatic",
  day: "Day",
  night: "Night",
};

/**
 * Every built world, then any planned ones, greyed out. The description
 * says what the metaphor is before anyone commits to it, and what the
 * world looks like after dark.
 */
export function WorldPicker({
  current,
  onChange,
  lighting,
  onLightingChange,
}: WorldPickerProps) {
  return (
    <div className="atlas-panel" role="dialog" aria-label="Choose a world">
      {lighting && onLightingChange && (
        <fieldset className="atlas-lighting">
          <legend className="atlas-panel-title">Lighting</legend>
          {lightingPreferences.map((option) => (
            <label key={option} className="atlas-lighting-option">
              <input
                type="radio"
                name="atlas-lighting"
                value={option}
                checked={lighting === option}
                onChange={() => onLightingChange(option)}
              />
              <span>{lightingNames[option]}</span>
            </label>
          ))}
        </fieldset>
      )}
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
                <span className="atlas-world-night">
                  {describeNight(world)}
                </span>
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
