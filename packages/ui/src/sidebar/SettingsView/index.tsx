import {
  resolveLighting,
  worldLooks as worlds,
  type LightingPreference,
  type SoundCue,
  type SoundSettings,
} from "@atlas/worlds/looks";
import { useEffect, useId, useRef } from "react";

import { SoundPanel } from "../../components/SoundPanel";
import { WorldPicker } from "../../components/WorldPicker";
import { worldStyle } from "../../theme";
import { Icon } from "../Icon";
import { SIDEBAR_WORLDS, type SidebarWorldId } from "../theme/worlds";

export interface SettingsViewProps {
  world: SidebarWorldId;
  onWorld: (world: SidebarWorldId) => void;
  lighting: LightingPreference;
  onLighting: (lighting: LightingPreference) => void;
  /** Whether the device is dark now, for automatic lighting. */
  deviceIsDark: boolean;
  sound: SoundSettings;
  onSound: (sound: SoundSettings) => void;
  onPreview: (cue: SoundCue) => void;
  /** How fresh the worklist is, as the header used to say: "Live", "Synced 08:15". */
  sync: { text: string; title: string };
  onClose: () => void;
}

/**
 * The settings screen over the sidebar: the full page's own settings panel,
 * with the world (Astronomer or Mariner), its lighting where it has a night,
 * and the sound settings with the background ambiences. Back or Escape
 * returns to where it was opened.
 */
export function SettingsView({
  world,
  onWorld,
  lighting,
  onLighting,
  deviceIsDark,
  sound,
  onSound,
  onPreview,
  sync,
  onClose,
}: SettingsViewProps) {
  const title = useId();
  const back = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      from?.focus?.();
    };
  }, []);

  const definition = worlds[world];
  const resolved = resolveLighting(lighting, deviceIsDark);
  return (
    <div
      className="detail settings"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title}
    >
      <div className="inner">
        <div className="dbar">
          <button
            ref={back}
            type="button"
            className="dback"
            aria-label="Back to Atlas"
            onClick={onClose}
          >
            <Icon name="back" />
            <span aria-hidden="true">Back</span>
          </button>
          <div className="dt">
            <h2 id={title}>Settings</h2>
          </div>
        </div>
        <p className="sync-line" title={sync.title}>
          Worklist: {sync.text}
        </p>
        <div
          className="atlas"
          data-world={world}
          data-lighting={resolved}
          data-mode="story"
          style={worldStyle(definition, resolved)}
        >
          <SoundPanel
            embedded
            settings={sound}
            onChange={onSound}
            onPreview={onPreview}
          >
            <WorldPicker
              variant="section"
              current={world}
              worlds={SIDEBAR_WORLDS}
              {...(definition.night
                ? { lighting, onLightingChange: onLighting }
                : {})}
              onChange={(id) => onWorld(id as SidebarWorldId)}
            />
          </SoundPanel>
        </div>
      </div>
    </div>
  );
}
