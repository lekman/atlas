/** The small panels opened from the header: world picker, key and sound. */
import { agentStatuses } from "@atlas/core";
import {
  plannedWorlds,
  worldIds,
  worlds,
  type SoundCategory,
  type SoundCue,
  type SoundSettings,
  type World,
  type WorldId,
} from "@atlas/worlds";

export interface WorldPickerProps {
  current: WorldId;
  onChange(id: WorldId): void;
}

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

export interface KeyPanelProps {
  world: World;
}

export function KeyPanel({ world }: KeyPanelProps) {
  const { vocabulary, statusNames } = world;
  const rows: Array<[string, string]> = [
    ["Home", `${vocabulary.homeName}, the ${vocabulary.home}`],
    ["Client", vocabulary.client],
    ["Requirement", vocabulary.requirement],
    ["Backlog item", vocabulary.item],
    ["Agent", vocabulary.agent],
    ["Open question", vocabulary.question],
    ["Decision", vocabulary.decision],
    ["Agent to agent", vocabulary.agentMessage],
    ["Outside system", vocabulary.externalEvent],
  ];
  return (
    <div
      className="atlas-panel"
      role="dialog"
      aria-label={`Key to the ${world.name} world`}
    >
      <h2 className="atlas-panel-title">Key · {world.name}</h2>
      <table className="atlas-key">
        <tbody>
          {rows.map(([real, themed]) => (
            <tr key={real}>
              <th scope="row">{real}</th>
              <td>{themed}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="atlas-panel-title">Status</h2>
      <table className="atlas-key">
        <tbody>
          {agentStatuses
            .filter((status) => status !== "error")
            .map((status) => (
              <tr key={status}>
                <th scope="row">
                  {status === "blocked" ? "blocked or error" : status}
                </th>
                <td>
                  <span
                    className="atlas-dot"
                    style={{ background: `var(--atlas-${status})` }}
                    aria-hidden="true"
                  />
                  {status === "blocked"
                    ? `${statusNames.blocked} or ${statusNames.error}`
                    : statusNames[status]}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export interface SoundPanelProps {
  settings: SoundSettings;
  onChange(settings: SoundSettings): void;
  onPreview(cue: SoundCue): void;
}

const categoryNames: Array<[SoundCategory, string]> = [
  ["message", "Agent to agent"],
  ["status", "Status changes"],
  ["external", "Outside systems"],
  ["needs", "Needs you and blocked"],
];

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
