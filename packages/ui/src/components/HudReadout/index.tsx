import { needsYou, type Dataset } from "@atlas/core";
import type { Camera, World } from "@atlas/worlds";

export interface HudReadoutProps {
  /** Whose words the readout uses. */
  world: World;
  /** What is counted: clients, agents, who is active, what needs you. */
  dataset: Dataset;
  /** Where the map is looking, for worlds that show a position or a scale. */
  camera: Camera | null;
  /** The map's size in pixels, to turn the camera into a map position. */
  viewport: { width: number; height: number };
}

/**
 * The corner readout over the full map, in the world's own words. Hidden
 * from screen readers: everything it counts is in the needs-you list and
 * the map's own description, and a line that changes as the map pans would
 * only be noise.
 */
export function HudReadout({
  world,
  dataset,
  camera,
  viewport,
}: HudReadoutProps) {
  const readout = world.readout({
    clients: dataset.clients.filter((client) => client.home !== true).length,
    agents: dataset.agents.length,
    active: dataset.agents.filter(
      (agent) => agent.status === "running" || agent.status === "watching",
    ).length,
    needsYou: needsYou(dataset).length,
    openQuestions: dataset.questions.filter(
      (question) => question.state === "open",
    ).length,
    x: camera ? (viewport.width / 2 - camera.x) / camera.scale : 0,
    y: camera ? (viewport.height / 2 - camera.y) / camera.scale : 0,
    scale: camera?.scale ?? 1,
    time: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  const [first, ...rest] = readout.lines;
  return (
    <div className="atlas-hud" aria-hidden="true">
      {readout.title && <strong>{readout.title}</strong>}
      {first && <span>{first}</span>}
      <span className="atlas-hud-attention">{readout.attention}</span>
      {rest.map((line) => (
        <span key={line}>{line}</span>
      ))}
      <span className="atlas-hud-hint">
        Double-click a {world.vocabulary.client} to zoom in; again, or empty
        space, for the whole map
      </span>
    </div>
  );
}
