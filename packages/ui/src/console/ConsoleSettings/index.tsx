import {
  backgrounds,
  lightingPreferences,
  worldLooks as worlds,
  type BackgroundChoice,
  type LightingPreference,
  type SoundCategory,
  type SoundCue,
  type SoundSettings,
} from "@atlas/worlds/looks";
import { useId } from "react";

import {
  SIDEBAR_WORLDS,
  type SidebarWorldId,
} from "../../sidebar/theme/worlds";
import { SectionHeading } from "../SectionHeading";
import { SegmentedSwitch } from "../SegmentedSwitch";

export interface ConsoleSettingsProps {
  world: SidebarWorldId;
  onWorld(world: SidebarWorldId): void;
  lighting: LightingPreference;
  onLighting(lighting: LightingPreference): void;
  sound: SoundSettings;
  onSound(sound: SoundSettings): void;
  /** Plays one cue in the chosen world's voice. */
  onPreview(cue: SoundCue): void;
  /** How fresh the worklist is: "Live", "Synced 08:15", and why. */
  sync: { text: string; title: string; tone?: "normal" | "err" };
}

const categoryNames: Array<[SoundCategory, string, SoundCue]> = [
  ["message", "Agent to agent", "message"],
  ["status", "Status changes", "status"],
  ["external", "Outside systems", "external"],
  ["needs", "Needs you and blocked", "needs"],
];

const lightingNames: Record<LightingPreference, string> = {
  automatic: "Automatic",
  day: "Day",
  night: "Night",
};

const backgroundChoices: Array<{
  id: BackgroundChoice;
  name: string;
  description: string;
}> = [
  { id: "off", name: "Off", description: "No background sound." },
  ...backgrounds,
];

/**
 * The console's settings, the same ones the sidebar keeps on this device:
 * the world (whose voice the sounds use) and its lighting, the sound
 * switches and volume, and the background ambience. A change applies and
 * is saved at once.
 */
export function ConsoleSettings({
  world,
  onWorld,
  lighting,
  onLighting,
  sound,
  onSound,
  onPreview,
  sync,
}: ConsoleSettingsProps) {
  const id = useId();
  const set = (patch: Partial<SoundSettings>) =>
    onSound({ ...sound, ...patch });
  return (
    <div className="console-settings">
      <SectionHeading title="Settings" />
      <p
        className="console-settings-sync"
        data-tone={sync.tone ?? "normal"}
        title={sync.title}
      >
        Worklist: {sync.text}
      </p>

      <fieldset className="console-settings-group">
        <legend className="console-label">World</legend>
        <p className="console-note">
          The world chooses what each sound is like.
        </p>
        <div className="console-choices">
          {SIDEBAR_WORLDS.map((w) => (
            <label key={w} className="console-choice">
              <input
                type="radio"
                name={`${id}-world`}
                value={w}
                checked={world === w}
                onChange={() => onWorld(w)}
              />
              <span>
                <strong>{worlds[w].name}</strong>
                <em>{worlds[w].description}</em>
              </span>
            </label>
          ))}
        </div>
        {worlds[world].night ? (
          <div className="console-settings-row">
            <span>Lighting</span>
            <SegmentedSwitch
              label="Lighting"
              options={lightingPreferences.map((value) => ({
                value,
                name: lightingNames[value],
              }))}
              value={lighting}
              onChange={onLighting}
            />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="console-settings-group">
        <legend className="console-label">Sound</legend>
        <label className="console-settings-row">
          <span>Sound on</span>
          <input
            type="checkbox"
            role="switch"
            className="console-toggle"
            checked={sound.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
        </label>
        <label className="console-settings-row">
          <span>Volume</span>
          <input
            type="range"
            className="console-range"
            min={0}
            max={1}
            step={0.05}
            value={sound.volume}
            disabled={!sound.enabled}
            onChange={(e) => set({ volume: Number(e.target.value) })}
          />
        </label>
        {categoryNames.map(([category, name, cue]) => (
          <div key={category} className="console-settings-row">
            <label className="console-settings-check">
              <input
                type="checkbox"
                role="switch"
                className="console-toggle"
                checked={sound.categories[category]}
                disabled={!sound.enabled}
                onChange={(e) =>
                  set({
                    categories: {
                      ...sound.categories,
                      [category]: e.target.checked,
                    },
                  })
                }
              />
              <span>{name}</span>
            </label>
            <button
              type="button"
              className="console-secondary console-settings-play"
              aria-label={`Play ${name.toLowerCase()}`}
              onClick={() => onPreview(cue)}
            >
              Play
            </button>
          </div>
        ))}
      </fieldset>

      <fieldset className="console-settings-group">
        <legend className="console-label">Background</legend>
        <div className="console-choices">
          {backgroundChoices.map((option) => (
            <label key={option.id} className="console-choice">
              <input
                type="radio"
                name={`${id}-background`}
                value={option.id}
                checked={sound.background === option.id}
                onChange={() =>
                  set({
                    background: option.id,
                    // Choosing a background is a request to hear it.
                    enabled: option.id === "off" ? sound.enabled : true,
                  })
                }
              />
              <span>
                <strong>{option.name}</strong>
                <em>{option.description}</em>
              </span>
            </label>
          ))}
        </div>
        <label className="console-settings-row">
          <span>Background volume</span>
          <input
            type="range"
            className="console-range"
            min={0}
            max={1}
            step={0.05}
            value={sound.backgroundVolume}
            disabled={sound.background === "off"}
            onChange={(e) => set({ backgroundVolume: Number(e.target.value) })}
          />
        </label>
      </fieldset>
    </div>
  );
}
