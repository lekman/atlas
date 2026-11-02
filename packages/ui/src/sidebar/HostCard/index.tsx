import { useId, type CSSProperties } from "react";

import {
  HOST_LINES,
  HOST_METRICS,
  hostLevel,
  metricName,
  seenText,
  SPARK,
  sparkline,
  type HostStat,
} from "../hosts/model";

export interface HostCardProps {
  host: HostStat;
  /** The client's name and colour. */
  client: { name: string; colour: string };
  open: boolean;
  onToggle: () => void;
  now: Date;
  /** False for a stored copy, which is judged against `storedAt`. */
  live: boolean;
  storedAt: Date | null;
}

const STATE = { crit: "critical", warn: "warning" } as const;

/**
 * One host: its name, client and a status dot, opening to when it was last
 * seen, its breaches, its latest values and 24-hour lines.
 */
export function HostCard({
  host,
  client,
  open,
  onToggle,
  now,
  live,
  storedAt,
}: HostCardProps) {
  const body = useId();
  const level = hostLevel(host);
  const state = level ? STATE[level] : "healthy";
  const className = ["host", level ?? "", open ? "open" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={className}
      style={{ "--c": client.colour } as CSSProperties}
    >
      <button
        type="button"
        className="hh"
        aria-expanded={open}
        aria-controls={body}
        onClick={onToggle}
      >
        <b>{host.host}</b>
        <span className="cust">{client.name}</span>
        <span
          className={`sd ${level ?? "ok"}`}
          role="img"
          aria-label={state}
          title={state}
        />
        <span className="chev" aria-hidden="true" />
      </button>
      {open && (
        <HostBody
          id={body}
          host={host}
          now={now}
          live={live}
          storedAt={storedAt}
        />
      )}
    </div>
  );
}

function HostBody({
  id,
  host,
  now,
  live,
  storedAt,
}: {
  id: string;
  host: HostStat;
  now: Date;
  live: boolean;
  storedAt: Date | null;
}) {
  const seen = seenText(host, { now, live, storedAt });
  const breaches = host.breaches ?? [];
  const byMetric = new Map(breaches.map((b) => [b.metric, b.level]));
  const latest = host.latest ?? {};
  const runners =
    typeof latest.runnersMax === "number" ||
    typeof latest.runnersBusy === "number";
  return (
    <div className="hb" id={id}>
      <span className={seen.stale ? "seen stale" : "seen"}>{seen.text}</span>
      {breaches.length > 0 && (
        <div className="br">
          {breaches.map((b) => (
            <span key={`${b.metric}-${b.level}`} className={`tag ${b.level}`}>
              {metricName(b.metric)}{" "}
              {b.level === "crit" ? "critical" : "warning"}
            </span>
          ))}
        </div>
      )}
      <div className="vals">
        {HOST_METRICS.filter((m) => typeof latest[m.key] === "number").map(
          (m) => (
            <div
              key={m.key}
              className={`val ${byMetric.get(m.key) ?? ""}`.trim()}
            >
              <div className="k">{m.name}</div>
              <div className="v">
                {m.format(latest[m.key] as number)}
                {m.unit && <small>{m.unit}</small>}
              </div>
            </div>
          ),
        )}
        {/* Any host that reports runners gets the line, busy or not. */}
        {runners && (
          <div className="val">
            <div className="k">Runners busy</div>
            <div className="v">
              {latest.runnersBusy ?? 0}
              {typeof latest.runnersMax === "number" && (
                <small>of {latest.runnersMax}</small>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="lines">
        {HOST_LINES.map((line) => {
          const spark = sparkline(host.samples ?? [], line, now);
          return (
            <div key={line.key} className="line">
              <div className="k">
                <span>{line.name}</span>
                <span>24 h</span>
              </div>
              <svg
                viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {spark.limitY !== null && (
                  <line
                    className="lim"
                    x1={0}
                    x2={SPARK.width}
                    y1={spark.limitY}
                    y2={spark.limitY}
                  />
                )}
                {spark.points && <polyline points={spark.points} />}
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}
