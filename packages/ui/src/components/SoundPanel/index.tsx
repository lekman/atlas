import type { SoundCategory, SoundCue, SoundSettings } from "@atlas/worlds";

export interface SoundPanelProps {
  /** Sound is off until the reader turns it on. */
  settings: SoundSettings;
  /** The whole new settings object, after any switch or the volume moved. */
  onChange(settings: SoundSettings): void;
  /** Play one cue now, so the reader hears what they are switching on. */
  onPreview(cue: SoundCue): void;
}

const categoryNames: Array<[SoundCategory, string]> = [
  ["message", "Agent to agent"],
  ["status", "Status changes"],
  ["external", "Outside systems"],
  ["needs", "Needs you and blocked"],
];

/**
 * The master switch, the volume and a switch per kind of sound. Nothing
 * plays until the reader asks; a world only chooses what each cue sounds
 * like.
 */
export function SoundPanel({ settings, onChange, onPreview }: SoundPanelProps) {
  return (
    <div className="atlas-panel" role="dialog" aria-label="Sound">
      <h2 className="atlas-panel-title">Sound</h2>
      <label className="atlas-row" htmlFor="atlas-sound-on">
        <span>Sound on</span>
        <input
          id="atlas-sound-on"
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) =>
            onChange({ ...settings, enabled: event.target.checked })
          }
        />
      </label>
      <label className="atlas-row" htmlFor="atlas-sound-volume">
        <span>Volume</span>
        <input
          id="atlas-sound-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(event) =>
            onChange({ ...settings, volume: Number(event.target.value) })
          }
        />
      </label>
      {categoryNames.map(([category, name]) => (
        <label
          className="atlas-row"
          htmlFor={`atlas-sound-${category}`}
          key={category}
        >
          <span>{name}</span>
          <input
            id={`atlas-sound-${category}`}
            type="checkbox"
            checked={settings.categories[category]}
            onChange={(event) =>
              onChange({
                ...settings,
                categories: {
                  ...settings.categories,
                  [category]: event.target.checked,
                },
              })
            }
          />
        </label>
      ))}
      <div className="atlas-actions">
        <button
          type="button"
          className="atlas-button"
          onClick={() => onPreview("needs")}
        >
          Play “needs you”
        </button>
        <button
          type="button"
          className="atlas-button"
          onClick={() => onPreview("message")}
        >
          Play a message
        </button>
      </div>
    </div>
  );
}
