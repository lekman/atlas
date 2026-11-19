import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  HOST_METRICS,
  nearestPoint,
  SPARK,
  type HostLine,
  type SparkPoint,
} from "../../sidebar/hosts/model";

export interface HostLineChartProps {
  line: HostLine;
  points: readonly SparkPoint[];
  limitY: number | null;
  now: Date;
}

/** A measured time in 24-hour form, "14:05", with "Yesterday" before it when it was. */
export function pointTime(at: string, now: Date): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return d.toDateString() === now.toDateString() ? time : `Yesterday ${time}`;
}

/** A measured value as the host's facts write it: "26 %", "65.1 GB". */
export function pointValue(line: HostLine, value: number): string {
  const metric = HOST_METRICS.find((m) => m.key === line.key);
  if (!metric) return String(value);
  return `${metric.format(value)}${metric.unit ? ` ${metric.unit}` : ""}`;
}

/**
 * One host figure over the last 24 hours, with its limit dashed. Pointing
 * at the chart, touching it or moving a finger along it shows the nearest
 * measured point: a guide line, a dot, and its time and value. A touch
 * keeps the point until the reader touches elsewhere. With the keyboard,
 * the left and right arrows step through the points.
 */
export function HostLineChart({
  line,
  points,
  limitY,
  now,
}: HostLineChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<SparkPoint | null>(null);

  // A touch keeps its point; touching anywhere else hides it.
  useEffect(() => {
    if (!shown) return;
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setShown(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [shown]);

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const x = ((e.clientX - rect.left) / rect.width) * SPARK.width;
    setShown(nearestPoint(points, x));
  };

  const step = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!points.length) return;
    const at = shown ? points.indexOf(shown) : -1;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next =
        at < 0
          ? e.key === "ArrowRight"
            ? 0
            : points.length - 1
          : Math.min(
              points.length - 1,
              Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)),
            );
      setShown(points[next] ?? null);
    } else if (e.key === "Escape") setShown(null);
  };

  const left = shown ? (shown.x / SPARK.width) * 100 : 0;
  const top = shown ? (shown.y / SPARK.height) * 100 : 0;
  const label = shown
    ? `${pointTime(shown.at, now)} · ${pointValue(line, shown.value)}`
    : "";
  const edge = left < 18 ? "start" : left > 82 ? "end" : "middle";

  return (
    <figure className="console-line">
      <figcaption>{line.name}</figcaption>
      <div
        ref={box}
        className="console-chart"
        role="group"
        aria-label={`${line.name} over the last 24 hours, limit ${line.limit}. Use the left and right arrows to read each point.`}
        tabIndex={0}
        onPointerDown={pick}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) pick(e);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setShown(null);
        }}
        onKeyDown={step}
        onBlur={() => setShown(null)}
      >
        <svg
          viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
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
            points={points
              .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
              .join(" ")}
            className="console-line-value"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {shown ? (
          <>
            <span
              className="console-chart-guide"
              style={{ left: `${left}%` }}
              aria-hidden="true"
            />
            <span
              className="console-chart-dot"
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-hidden="true"
            />
            <span
              className="console-chart-tip"
              data-edge={edge}
              style={{ left: `${left}%` }}
              aria-hidden="true"
            >
              {label}
            </span>
          </>
        ) : null}
        <span className="console-visually-hidden" aria-live="polite">
          {label}
        </span>
      </div>
    </figure>
  );
}
