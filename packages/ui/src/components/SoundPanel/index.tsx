import {
  backgrounds,
  type BackgroundChoice,
  type SoundCategory,
  type SoundCue,
  type SoundSettings,
} from "@atlas/worlds";
import type { ReactNode } from "react";

export interface SoundPanelProps {
  /** Sound is off until the reader turns it on. */
  settings: SoundSettings;
  /** The whole new settings object, after any switch or the volume moved. */
  onChange(settings: SoundSettings): void;
  /** Play one cue now, so the reader hears what they are switching on. */
  onPreview(cue: SoundCue): void;
  /** Settings shown above the sound ones, such as the choice of world. */
  children?: ReactNode;
}

const categoryNames: Array<[SoundCategory, string]> = [
  ["message", "Agent to agent"],
  ["status", "Status changes"],
  ["external", "Outside systems"],
  ["needs", "Needs you and blocked"],
];

/**
 * The settings panel: the master switch, the volume, a switch per kind of
 * sound, and the background ambience with its own volume. Nothing plays
 * until the reader asks; a world only chooses what each cue sounds like.
 * Other settings, such as the world, go above the sound ones as children.
 */
export function SoundPanel({
  settings,
  onChange,
  onPreview,
  children,
}: SoundPanelProps) {
  return (
    <div className="atlas-panel" role="dialog" aria-label="Settings">
      {children}
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
      <fieldset className="atlas-background">
        <legend className="atlas-panel-title">Background</legend>
        {(
          [
            { id: "off", name: "Off", description: "No background sound." },
            ...backgrounds,
          ] as Array<{
            id: BackgroundChoice;
            name: string;
            description: string;
          }>
        ).map((option) => (
          <label
            className="atlas-background-option"
            key={option.id}
            htmlFor={`atlas-background-${option.id}`}
          >
            <input
              id={`atlas-background-${option.id}`}
              type="radio"
              name="atlas-background"
              value={option.id}
              checked={settings.background === option.id}
              onChange={() =>
                onChange({
                  ...settings,
                  background: option.id,
                  // Choosing a background is a request to hear it.
                  enabled: option.id === "off" ? settings.enabled : true,
                })
              }
            />
            <span>
              <strong>{option.name}</strong>
              <em>{option.description}</em>
            </span>
          </label>
        ))}
        <label className="atlas-row" htmlFor="atlas-background-volume">
          <span>Background volume</span>
          <input
            id="atlas-background-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.backgroundVolume}
            onChange={(event) =>
              onChange({
                ...settings,
                backgroundVolume: Number(event.target.value),
              })
            }
          />
        </label>
      </fieldset>
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
