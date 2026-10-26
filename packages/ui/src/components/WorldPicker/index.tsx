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
  /**
   * The worlds to offer. Every built world, then the planned ones, unless a
   * list is given; then only those, and no planned worlds.
   */
  worlds?: readonly WorldId[];
  /**
   * A dialog of its own, or a section at the top of the settings panel,
   * where the worlds are radio buttons like the other settings.
   */
  variant?: "dialog" | "section";
}

const lightingNames: Record<LightingPreference, string> = {
  automatic: "Automatic",
  day: "Day",
  night: "Night",
};

/** Automatic, Day and Night as one row of radio buttons. */
function LightingChoice({
  lighting,
  onLightingChange,
}: {
  lighting: LightingPreference;
  onLightingChange(lighting: LightingPreference): void;
}) {
  return (
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
  );
}

/**
 * Every built world, then any planned ones, greyed out. The description
 * says what the metaphor is before anyone commits to it, and what the
 * world looks like after dark.
 *
 * As a section of the settings panel it lists only the offered worlds, each
 * a radio button with its description, in the same shape as the background
 * sounds below it, so the panel reads as one form. The night description is
 * left out there to keep the panel short.
 */
export function WorldPicker({
  current,
  onChange,
  lighting,
  onLightingChange,
  worlds: offered,
  variant = "dialog",
}: WorldPickerProps) {
  const lightingChoice = lighting && onLightingChange && (
    <LightingChoice lighting={lighting} onLightingChange={onLightingChange} />
  );
  if (variant === "section")
    return (
      <>
        <fieldset className="atlas-world-choice">
          <legend className="atlas-panel-title">World</legend>
          {(offered ?? worldIds).map((id) => (
            <label
              className="atlas-world-option"
              key={id}
              htmlFor={`atlas-world-${id}`}
            >
              <input
                id={`atlas-world-${id}`}
                type="radio"
                name="atlas-world"
                value={id}
                checked={id === current}
                onChange={() => onChange(id)}
              />
              <span>
                <strong>{worlds[id].name}</strong>
                <em>{worlds[id].description}</em>
              </span>
            </label>
          ))}
        </fieldset>
        {lightingChoice}
      </>
    );
  return (
    <div className="atlas-panel" role="dialog" aria-label="Choose a world">
      {lightingChoice}
      <h2 className="atlas-panel-title">World</h2>
      <ul className="atlas-worlds">
        {(offered ?? worldIds).map((id) => {
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
        {!offered &&
          plannedWorlds.map((planned) => (
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
