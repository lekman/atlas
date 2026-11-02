import {
  createAmbiencePlayer,
  createSoundPlayer,
  defaultSoundSettings,
  isBackgroundChoice,
  lightingPreferences,
  resolveLighting,
  worlds,
  type AmbiencePlayer,
  type Lighting,
  type LightingPreference,
  type SoundCue,
  type SoundSettings,
} from "@atlas/worlds";
import { isSidebarWorld, type SidebarWorldId } from "@atlas/ui/sidebar";
import { useEffect, useRef, useState } from "react";

import { KEYS, load, save } from "./storage";

/** The sound settings as saved, with anything unreadable taken from the defaults. */
function readSound(): SoundSettings {
  try {
    const saved = JSON.parse(
      load(KEYS.sound, () => true) ?? "null",
    ) as Partial<SoundSettings> | null;
    if (!saved || typeof saved !== "object") return defaultSoundSettings;
    return {
      enabled:
        typeof saved.enabled === "boolean"
          ? saved.enabled
          : defaultSoundSettings.enabled,
      volume:
        typeof saved.volume === "number"
          ? saved.volume
          : defaultSoundSettings.volume,
      categories: {
        ...defaultSoundSettings.categories,
        ...(saved.categories ?? {}),
      },
      background: isBackgroundChoice(saved.background)
        ? saved.background
        : defaultSoundSettings.background,
      backgroundVolume:
        typeof saved.backgroundVolume === "number"
          ? saved.backgroundVolume
          : defaultSoundSettings.backgroundVolume,
    };
  } catch {
    return defaultSoundSettings;
  }
}

/** Whether the device is dark now, followed as it changes. */
function useDeviceDark(): boolean {
  const query =
    typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-color-scheme: dark)")
      : undefined;
  const [dark, setDark] = useState(Boolean(query?.matches));
  useEffect(() => {
    if (!query) return;
    const change = () => setDark(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, [query]);
  return dark;
}

export interface Preferences {
  world: SidebarWorldId;
  setWorld: (world: SidebarWorldId) => void;
  lighting: LightingPreference;
  setLighting: (lighting: LightingPreference) => void;
  /** The lighting drawn with now: the preference, or the device's when automatic. */
  resolved: Lighting;
  deviceIsDark: boolean;
  sound: SoundSettings;
  setSound: (sound: SoundSettings) => void;
  /** Plays one cue in the chosen world's voice, turning sound on. */
  preview: (cue: SoundCue) => void;
}

/**
 * The sidebar's look and sound, as the full page has them: the world
 * (Astronomer by default), its lighting, and the sound settings, each
 * remembered on this device. The background ambience plays while sound is
 * on and one is chosen; a browser holds audio back until the first click
 * or key after a load, so that asks again.
 */
export function usePreferences(): Preferences {
  const [world, setWorldState] = useState<SidebarWorldId>(
    () =>
      (load(KEYS.world, isSidebarWorld) as SidebarWorldId | null) ??
      "astronomer",
  );
  const [lighting, setLightingState] = useState<LightingPreference>(
    () =>
      (load(KEYS.lighting, (v) =>
        lightingPreferences.includes(v as LightingPreference),
      ) as LightingPreference | null) ?? "automatic",
  );
  const [sound, setSoundState] = useState<SoundSettings>(readSound);
  const deviceIsDark = useDeviceDark();

  const ambience = useRef<AmbiencePlayer | null>(null);
  useEffect(() => {
    ambience.current ??= createAmbiencePlayer();
    const player = ambience.current;
    const apply = () =>
      sound.enabled && sound.background !== "off"
        ? player.play(sound.background, sound.backgroundVolume)
        : player.stop();
    apply();
    window.addEventListener("pointerdown", apply, { once: true });
    window.addEventListener("keydown", apply, { once: true });
    return () => {
      window.removeEventListener("pointerdown", apply);
      window.removeEventListener("keydown", apply);
    };
  }, [sound.enabled, sound.background, sound.backgroundVolume]);
  useEffect(() => () => ambience.current?.stop(), []);

  const cues = useRef(createSoundPlayer());
  const setSound = (next: SoundSettings) => {
    setSoundState(next);
    save(KEYS.sound, JSON.stringify(next));
  };

  return {
    world,
    setWorld: (next) => {
      setWorldState(next);
      save(KEYS.world, next);
    },
    lighting,
    setLighting: (next) => {
      setLightingState(next);
      save(KEYS.lighting, next);
    },
    // A world without a night of its own stays as it is by day.
    resolved: worlds[world].night
      ? resolveLighting(lighting, deviceIsDark)
      : "day",
    deviceIsDark,
    sound,
    setSound,
    preview: (cue) => {
      const on = { ...sound, enabled: true };
      setSound(on);
      cues.current.preview(worlds[world], cue, on);
    },
  };
}
