import type { World } from "@atlas/worlds";

import { describeEvent } from "./describe";
import type { LogEntry } from "./useAtlasMap";

export interface LogPanelProps {
  entries: LogEntry[];
  world: World;
  /** `panel` floats over the full map; `preview` sits in the sidebar. */
  variant: "panel" | "preview";
  limit?: number;
}

const clock = (time: Date, seconds: boolean) =>
  time.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  });

/** The running log of events, written in the world's voice. */
export function LogPanel({
  entries,
  world,
  variant,
  limit = variant === "panel" ? 8 : 4,
}: LogPanelProps) {
  const shown = entries.slice(0, limit);
  return (
    <section
      className={`atlas-log atlas-log-${variant}`}
      aria-labelledby={`atlas-log-${variant}`}
      aria-live="polite"
    >
      <h2 className="atlas-section-title" id={`atlas-log-${variant}`}>
        <span>{world.vocabulary.log}</span>
        <span>
          {variant === "panel" ? `${entries.length} entries` : "live"}
        </span>
      </h2>
      {shown.length === 0 ? (
        <p className="atlas-empty">Listening…</p>
      ) : (
        <ol className="atlas-log-rows">
          {shown.map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.time.toISOString()}>
                {clock(entry.time, variant === "panel")}
              </time>
              <span>{describeEvent(world, entry.before, entry.event)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
