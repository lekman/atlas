import { needsYou, type Dataset } from "@atlas/core";
import type { Camera, World } from "@atlas/worlds";

export interface HudReadoutProps {
  world: World;
  dataset: Dataset;
  camera: Camera | null;
  viewport: { width: number; height: number };
}

/**
 * The corner readout: position and zoom for the Astronomer's console, scale
 * and a title for the Mariner's chart, and in both the counts that matter.
 */
export function HudReadout({
  world,
  dataset,
  camera,
  viewport,
}: HudReadoutProps) {
  const { vocabulary } = world;
  const clients = dataset.clients.filter(
    (client) => client.home !== true,
  ).length;
  const active = dataset.agents.filter(
    (agent) => agent.status === "running" || agent.status === "watching",
  ).length;
  const waiting = needsYou(dataset).length;
  const comets = dataset.questions.filter(
    (question) => question.state === "open",
  ).length;
  const time = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (world.id === "mariner") {
    const scale = camera ? Math.round(1000 / camera.scale) : 0;
    return (
      <div className="atlas-hud" aria-hidden="true">
        <strong>Chart of present work</strong>
        <span>
          {clients} {vocabulary.clients} · {dataset.agents.length}{" "}
          {vocabulary.agents} · {active} under way
        </span>
        <span className="atlas-hud-attention">
          {waiting} awaiting your orders · {comets} {vocabulary.questions}
        </span>
        <span>
          Scale 1 : {scale.toLocaleString("en-GB")} · {time}
        </span>
      </div>
    );
  }
  const x = camera
    ? ((viewport.width / 2 - camera.x) / camera.scale / 1000).toFixed(3)
    : "0.000";
  const y = camera
    ? ((viewport.height / 2 - camera.y) / camera.scale / 1000).toFixed(3)
    : "0.000";
  return (
    <div className="atlas-hud" aria-hidden="true">
      <span>
        X <strong>{x}</strong> Y <strong>{y}</strong> ZOOM{" "}
        <strong>{camera ? camera.scale.toFixed(2) : "-"}</strong>
      </span>
      <span>
        {clients} SYSTEMS · {dataset.agents.length} PROBES ·{" "}
        <strong>{active}</strong> UNDERWAY
      </span>
      <span className="atlas-hud-attention">
        {waiting} HAILING YOU · {comets} COMETS TRACKED
      </span>
      <span>{time} · LOCAL DATABASE · TAILNET ONLY</span>
    </div>
  );
}
