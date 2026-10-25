import { agentStatuses } from "@atlas/core";
import type { World } from "@atlas/worlds";

export interface KeyPanelProps {
  /** The world whose terms the key explains. */
  world: World;
}

/**
 * The real term beside the themed one, for every record and status. The
 * metaphor is never more than one tap from the plain word.
 */
export function KeyPanel({ world }: KeyPanelProps) {
  const { vocabulary, statusNames } = world;
  const rows: Array<[string, string]> = [
    ["Home", `${vocabulary.homeName}, the ${vocabulary.home}`],
    ["Client", vocabulary.client],
    ["Requirement", vocabulary.requirement],
    [
      "Workstream",
      vocabulary.homeWorkstream
        ? `${vocabulary.workstream}; at ${vocabulary.homeName}, a ${vocabulary.homeWorkstream}`
        : vocabulary.workstream,
    ],
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
