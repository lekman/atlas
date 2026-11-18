import { formatAgo } from "../../sidebar/format";
import {
  HOST_LINES,
  HOST_METRICS,
  seenText,
  SPARK,
  sparkline,
  type HostStat,
} from "../../sidebar/hosts/model";
import { relayWords, type RelayState } from "../layout";
import {
  shieldStateNames,
  type IntegrationInput,
  type ShieldRow,
} from "../shields";

export interface ShieldDetailProps {
  /** The row open, as the list built it. */
  row: ShieldRow;
  /** The host, when the row is one. */
  host?: HostStat;
  /** Whether host figures are live, and when a stored copy was saved. */
  hostsLive?: boolean;
  hostsStoredAt?: Date | null;
  /** The relay, with when the worklist was last read live and last synced. */
  relay?: RelayState;
  liveAt?: number | null;
  syncedAt?: string | null;
  /** The integration, when the row is one. */
  integration?: IntegrationInput;
  now: Date;
}

const breachWords = {
  warn: "over its warning limit",
  crit: "over its critical limit",
};

/**
 * One Shields row in full. A host shows its latest figures, which of them
 * are over a limit, and its last 24 hours as lines with the limit dashed.
 * The relay says what the page is reading and what waits. An integration
 * says when it last synced and why it failed.
 */
export function ShieldDetail({
  row,
  host,
  hostsLive = false,
  hostsStoredAt = null,
  relay,
  liveAt = null,
  syncedAt = null,
  integration,
  now,
}: ShieldDetailProps) {
  const facts: Array<[string, string]> = [
    ["State", shieldStateNames[row.state]],
  ];
  let body = null;

  if (row.kind === "host" && host) {
    facts.push([
      "Seen",
      seenText(host, { now, storedAt: hostsStoredAt, live: hostsLive }).text,
    ]);
    const latest = host.latest ?? {};
    for (const metric of HOST_METRICS) {
      const value = latest[metric.key];
      if (typeof value !== "number") continue;
      const breach = (host.breaches ?? []).find((b) => b.metric === metric.key);
      facts.push([
        metric.name,
        `${metric.format(value)}${metric.unit ? ` ${metric.unit}` : ""}${breach ? `, ${breachWords[breach.level]}` : ""}`,
      ]);
    }
    if (typeof latest.runnersMax === "number")
      facts.push([
        "Runners",
        `${latest.runnersBusy ?? 0} busy of ${latest.runnersMax}`,
      ]);
    const lines = HOST_LINES.map((line) => ({
      line,
      ...sparkline(host.samples ?? [], line, now),
    })).filter((l) => l.points);
    body = lines.length ? (
      <section className="console-lines" aria-label="Last 24 hours">
        <h3 className="console-label">Last 24 hours</h3>
        {lines.map(({ line, points, limitY }) => (
          <figure key={line.key} className="console-line">
            <figcaption>{line.name}</figcaption>
            <svg
              viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${line.name} over the last 24 hours, limit ${line.limit}`}
            >
              {limitY !== null ? (
                <line
                  x1="0"
                  x2={SPARK.width}
                  y1={limitY}
                  y2={limitY}
                  className="console-line-limit"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <polyline
                points={points}
                className="console-line-value"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </figure>
        ))}
      </section>
    ) : null;
  }

  if (row.kind === "relay" && relay) {
    facts.push(["Now", relayWords(relay)]);
    facts.push([
      "Last live read",
      liveAt ? formatAgo(new Date(liveAt), now) : "None on this device yet",
    ]);
    facts.push([
      "Worklist synced",
      syncedAt ? formatAgo(new Date(syncedAt), now) : "Not known",
    ]);
    if (relay.kind === "queued")
      facts.push([
        "Waiting",
        `${relay.count} change${relay.count === 1 ? "" : "s"} for the Mac mini`,
      ]);
    body = (
      <p className="console-note">
        {relay.kind === "live"
          ? "This page reads the Atlas server directly, so what you see is current."
          : relay.kind === "queued"
            ? "Changes made here wait in the inbox. The Mac mini applies them within a minute of being reachable."
            : "The server is not reachable from here, so this is the last copy saved. Changes are queued until it is back."}
      </p>
    );
  }

  if (row.kind === "integration" && integration) {
    facts.push([
      "Last sync",
      integration.syncedAt
        ? formatAgo(new Date(integration.syncedAt), now)
        : "None seen",
    ]);
    if (integration.error) facts.push(["Problem", integration.error]);
  }

  return (
    <article className="console-summary" aria-labelledby="console-shield-title">
      <h2 id="console-shield-title">{row.name}</h2>
      <dl>
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {body}
    </article>
  );
}
