import { formatAgo } from "../../sidebar/format";
import { agentState, STATIONS, type AgentRecord } from "../agent-state";

export interface LiveMapProps {
  agent: AgentRecord;
  now: Date;
}

const WIDTH = 320;
const HEIGHT = 196;
const CX = WIDTH / 2;
const CY = HEIGHT / 2 - 4;
const RX = 124;
const RY = 70;
const RING = 26;

/** Where station `i` of `n` sits on the ellipse, starting at the top. */
function stationAt(i: number, n: number) {
  const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return { x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle) };
}

/**
 * The window the context ring is measured against: 200k tokens, or 1M once
 * a session holds more than 200k, as the large-context models do.
 */
export const contextWindow = (tokens: number): number =>
  tokens > 200_000 ? 1_000_000 : 200_000;

const thousands = (tokens: number) =>
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    : `${Math.round(tokens / 1000)}k`;

/**
 * The agent's live view: the agent in the middle, one station for each kind
 * of work around it (files, edits, shell, git, web, other agents, you,
 * other). A spoke thickens with each switch to its station; the station the
 * agent works at now is lit, and pulses until the agent stops working. The ring
 * round the middle fills with the context the session holds.
 */
export function LiveMap({ agent, now }: LiveMapProps) {
  const counts = agent.activityCounts ?? {};
  const most = Math.max(1, ...Object.values(counts).map((c) => c ?? 0));
  // The station stays lit and pulsing while the agent works, however old
  // the reading; it stops once a later reading shows the agent stopped.
  const live = agentState(agent) === "working";
  const current = agent.activity;
  const tokens = agent.contextTokens;
  const share =
    typeof tokens === "number"
      ? Math.min(1, tokens / contextWindow(tokens))
      : 0;
  const circumference = 2 * Math.PI * RING;
  const anything =
    !!current || typeof tokens === "number" || Object.keys(counts).length > 0;
  const word = STATIONS.find((s) => s.activity === current)?.word;
  const summary = [
    word ? `${live ? "now" : "last"} at ${word}` : "no activity reported",
    typeof tokens === "number"
      ? `context ${thousands(tokens)} of ${thousands(contextWindow(tokens))}`
      : null,
    ...STATIONS.filter((s) => counts[s.activity]).map(
      (s) => `${s.word} ${counts[s.activity]}`,
    ),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <figure className="console-live" data-live={live || undefined}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Live view: ${summary}`}
        className="console-live-map"
        data-empty={!anything || undefined}
      >
        {STATIONS.map((s, i) => {
          const at = stationAt(i, STATIONS.length);
          const count = counts[s.activity] ?? 0;
          const lit = s.activity === current;
          return (
            <g
              key={s.activity}
              className="console-live-station"
              data-lit={lit || undefined}
              data-worn={count > 0 || undefined}
            >
              <line
                x1={CX}
                y1={CY}
                x2={at.x}
                y2={at.y}
                className="console-live-spoke"
                strokeWidth={count ? 1 + (count / most) * 4 : 1}
              />
              {lit && live ? (
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={7}
                  className="console-live-pulse"
                />
              ) : null}
              <circle cx={at.x} cy={at.y} r={lit ? 7 : 5} />
              <text
                x={at.x}
                y={at.y + (at.y < CY ? -12 : 20)}
                textAnchor="middle"
              >
                {s.word}
                {count ? ` ${count}` : ""}
              </text>
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={RING} className="console-live-ring" />
        {share > 0 ? (
          <circle
            cx={CX}
            cy={CY}
            r={RING}
            className="console-live-context"
            strokeDasharray={`${share * circumference} ${circumference}`}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        ) : null}
        <circle cx={CX} cy={CY} r={RING - 6} className="console-live-core" />
        <text
          x={CX}
          y={CY + 4}
          textAnchor="middle"
          className="console-live-core-text"
        >
          {typeof tokens === "number" ? thousands(tokens) : "—"}
        </text>
      </svg>
      <figcaption className="console-live-caption">
        {!anything
          ? "No live readings from this agent yet. Its hooks send them to Atlas."
          : [
              word
                ? `${live ? "Now" : "Last"}: ${word}${
                    agent.activityAt
                      ? `, ${formatAgo(new Date(agent.activityAt), now)}`
                      : ""
                  }`
                : null,
              typeof tokens === "number"
                ? `Context ${thousands(tokens)} of ${thousands(contextWindow(tokens))}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
      </figcaption>
    </figure>
  );
}
