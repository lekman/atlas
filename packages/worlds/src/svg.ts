/**
 * A still map as an SVG string.
 *
 * Used where a canvas cannot run: the Claude Code plugin pane (desktop and
 * iPhone draw an `Svg` element, never script), thumbnails, and link previews.
 * It shows where every client and agent is, each client's workstreams with
 * the work drawn beside them, and what needs you, with the same status
 * colours as the live map, and nothing else.
 */
import { clientOfAgent, type Dataset } from "@atlas/core";

import { computeLayout, type Orientation } from "./layout";
import { workstreamCaption } from "./paint";
import { paletteFor } from "./lighting";
import { Scene } from "./scene";
import type { Lighting, World } from "./types";

export interface SnapshotOptions {
  width: number;
  height: number;
  orientation?: Orientation;
  /** Day by default: a still map in a plugin pane has no device to follow. */
  lighting?: Lighting;
}

const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] ?? character,
  );

export function renderSnapshot(
  world: World,
  dataset: Dataset,
  options: SnapshotOptions,
): string {
  const orientation =
    options.orientation ??
    (options.height > options.width * 1.15 ? "portrait" : "landscape");
  const layout = computeLayout(dataset, orientation);
  const scene = new Scene(dataset, orientation);
  const { left, top, right, bottom } = layout.bounds;
  const lighting = options.lighting ?? "day";
  const palette = paletteFor(world, lighting);
  const { vocabulary } = world;
  const font = world.typefaces.display.replace(/"/g, "'");
  const parts: string[] = [];

  const waiting = dataset.agents.filter((agent) =>
    scene.needsAttention(agent),
  ).length;
  const summary = `${dataset.clients.length - 1} ${vocabulary.clients}, ${dataset.agents.length} ${vocabulary.agents}, ${waiting} needing you`;

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${right - left} ${bottom - top}" width="${options.width}" height="${options.height}" role="img" aria-labelledby="atlas-title atlas-description">`,
    `<title id="atlas-title">Atlas, ${escapeXml(world.name)} world</title>`,
    `<desc id="atlas-description">${escapeXml(summary)}</desc>`,
    `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="${palette.ground}"/>`,
  );

  for (const client of dataset.clients) {
    const centre = layout.clients.get(client.id);
    if (!centre) continue;
    const home = client.home === true;
    parts.push(
      home
        ? world.stillMap.home(centre, client.id, lighting)
        : world.stillMap.client(centre, client.id, lighting),
    );
    parts.push(
      `<text x="${centre.x}" y="${centre.y + world.stillMap.labelOffset}" text-anchor="middle" font-family="${font}" font-size="54" fill="${home ? palette.accent : palette.ink}">${escapeXml(home ? vocabulary.homeName : client.name)}</text>`,
    );
  }

  for (const marker of layout.markers) {
    const { x, y } = marker.position;
    const caption = workstreamCaption(marker);
    parts.push(
      `<g><title>${escapeXml(`${caption}: ${marker.workstreamId ? vocabulary.workstream : "work with no workstream"}`)}</title>`,
      `<rect x="${(x - 12).toFixed(1)}" y="${(y - 12).toFixed(1)}" width="24" height="24" rx="5" fill="${palette.ground}" stroke="${palette.ink}" stroke-width="3"${marker.workstreamId ? "" : ' stroke-dasharray="5 4"'}/>`,
      `<text x="${x.toFixed(1)}" y="${(y - 26).toFixed(1)}" text-anchor="middle" font-family="${font}" font-size="24" fill="${palette.ink}">${escapeXml(caption)}</text>`,
    );
    for (const id of marker.shown) {
      const point = layout.fixed.get(id);
      if (!point) continue;
      parts.push(
        `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="6" fill="${palette.mute}"/>`,
      );
    }
    parts.push("</g>");
  }

  for (const agent of dataset.agents) {
    const position = scene.agentTarget(agent, 0, true);
    const colour = palette.status[agent.status];
    if (scene.needsAttention(agent)) {
      parts.push(
        `<circle cx="${position.x.toFixed(1)}" cy="${position.y.toFixed(1)}" r="34" fill="none" stroke="${colour}" stroke-width="5" stroke-opacity="0.7"/>`,
      );
    }
    parts.push(
      `<circle cx="${position.x.toFixed(1)}" cy="${position.y.toFixed(1)}" r="16" fill="${colour}"><title>${escapeXml(`${agent.name}: ${world.statusNames[agent.status]} (${agent.status}), ${clientOfAgent(dataset, agent)}`)}</title></circle>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}
