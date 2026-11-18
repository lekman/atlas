import type { HostStat } from "../../sidebar/hosts/model";
import type { RelayState } from "../layout";
import type { HostNetworkDoc } from "../network";
import { SectionHeading } from "../SectionHeading";
import {
  hostState,
  hostSummary,
  integrationRow,
  relayRow,
  shieldStateNames,
  type IntegrationInput,
  type ShieldRow,
} from "../shields";

export interface ShieldsListProps {
  /** The hosts the reader's machines report, or null before any answer. */
  hosts: readonly HostStat[] | null;
  /** Whether the host figures are live, and when a stored copy was saved. */
  hostsLive: boolean;
  hostsStoredAt: Date | null;
  /** What the link to the Atlas server is doing. */
  relay: RelayState;
  /** Each integration that feeds Atlas. */
  integrations: readonly IntegrationInput[];
  /** Each host's network and Tailscale device; devices with no figures join the hosts. */
  network?: HostNetworkDoc | null;
  now: Date;
  /** The row open in the detail. */
  selectedId?: string | null;
  /** Called with the row the reader opens. */
  onSelect(row: ShieldRow): void;
}

/** Every row Shields shows, in list order: hosts, the relay, then integrations. */
export function shieldRows({
  hosts,
  hostsLive,
  hostsStoredAt,
  relay,
  integrations,
  network,
  now,
}: Omit<ShieldsListProps, "selectedId" | "onSelect">): ShieldRow[] {
  const options = { now, storedAt: hostsStoredAt, live: hostsLive };
  const reported = new Set((hosts ?? []).map((h) => h.host.toLowerCase()));
  const tailnetOnly = (network?.hosts ?? [])
    .filter((entry) => !reported.has(entry.host.toLowerCase()))
    .map((entry): ShieldRow => ({
      id: `host:${entry.host}`,
      kind: "host",
      name: entry.host,
      state: entry.tailscale?.online ? "ok" : "unknown",
      summary: entry.tailscale
        ? `${entry.tailscale.os || "Device"} on the tailnet, ${entry.tailscale.online ? "online" : "offline"}; no figures`
        : "Reports its network; no figures",
    }));
  return [
    ...(hosts ?? []).map((host): ShieldRow => ({
      id: `host:${host.host}`,
      kind: "host",
      name: host.host,
      state: hostState(host, options),
      summary: hostSummary(host),
    })),
    ...tailnetOnly,
    relayRow(relay),
    ...integrations.map((input) => integrationRow(input, now)),
  ];
}

/**
 * The Shields list: the reader's machines, the relay and the integrations,
 * each with its state as a shape and one line about it. Shields covers
 * every system, so it has no scope button.
 */
export function ShieldsList(props: ShieldsListProps) {
  const rows = shieldRows(props);
  const groups: Array<[string, ShieldRow[]]> = [
    ["Hosts", rows.filter((r) => r.kind === "host")],
    ["Relay", rows.filter((r) => r.kind === "relay")],
    ["Integrations", rows.filter((r) => r.kind === "integration")],
  ];
  return (
    <div className="console-shields">
      <SectionHeading title="Shields" />
      {groups.map(([title, list]) => (
        <section key={title} className="console-group" aria-label={title}>
          <h2 className="console-group-title">{title}</h2>
          {list.length === 0 ? (
            <p className="console-shield-none">
              {props.hosts === null
                ? "Waiting for the first figures."
                : "None reported."}
            </p>
          ) : (
            <ul className="console-tasks">
              {list.map((row) => (
                <li
                  key={row.id}
                  className="console-shield"
                  data-state={row.state}
                  data-selected={row.id === props.selectedId || undefined}
                >
                  <button
                    type="button"
                    className="console-task-open"
                    aria-current={
                      row.id === props.selectedId ? "true" : undefined
                    }
                    onClick={() => props.onSelect(row)}
                  >
                    <span className="console-shield-state" aria-hidden="true" />
                    <span className="console-visually-hidden">
                      {shieldStateNames[row.state]}:{" "}
                    </span>
                    <span className="console-task-title">{row.name}</span>
                    <span className="console-task-meta">{row.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
