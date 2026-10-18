/**
 * A still map as an SVG string.
 *
 * Used where a canvas cannot run: the Claude Code plugin pane (desktop and
 * iPhone draw an `Svg` element, never script), thumbnails, and link previews.
 * It shows where every client and agent is and what needs you, with the
 * same status colours as the live map, and nothing else.
 */
import { clientOfAgent, type Dataset } from "@atlas/core";

import { computeLayout, type Orientation } from "./layout";
import { coastPath } from "./mariner/coast";
import { Scene } from "./scene";
import type { World } from "./types";

export interface SnapshotOptions {
  width: number;
  height: number;
  orientation?: Orientation;
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
  const { palette, vocabulary } = world;
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
    `<defs><radialGradient id="star"><stop offset="0" stop-color="#fff4dc"/><stop offset="0.15" stop-color="#ffc878" stop-opacity="0.6"/><stop offset="1" stop-color="#ff8c3c" stop-opacity="0"/></radialGradient></defs>`,
    `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="${palette.ground}"/>`,
  );

  for (const client of dataset.clients) {
    const centre = layout.clients.get(client.id);
    if (!centre) continue;
    const home = client.home === true;
    const name = home ? vocabulary.homeName : client.name;
    if (world.id === "mariner") {
      parts.push(
        `<path d="${coastPath(client.id, centre, 70, home ? 70 : 96)}" fill="#c9dde3" fill-opacity="0.45"/>`,
      );
      parts.push(
        `<path d="${coastPath(client.id, centre, 0, home ? 70 : 96)}" fill="#e7d29b" stroke="#5a3f22" stroke-width="3"/>`,
      );
    } else if (home) {
      parts.push(
        `<circle cx="${centre.x}" cy="${centre.y}" r="64" fill="#78beff" fill-opacity="0.18"/>`,
      );
      parts.push(
        `<circle cx="${centre.x}" cy="${centre.y}" r="34" fill="#2d6fae" stroke="#a0dcff" stroke-width="2"/>`,
      );
    } else {
      parts.push(
        `<circle cx="${centre.x}" cy="${centre.y}" r="90" fill="url(#star)"/>`,
      );
      parts.push(
        `<circle cx="${centre.x}" cy="${centre.y}" r="330" fill="none" stroke="${palette.accent}" stroke-opacity="0.15" stroke-width="3" stroke-dasharray="8 16"/>`,
      );
    }
    parts.push(
      `<text x="${centre.x}" y="${centre.y + (world.id === "mariner" ? 150 : -250)}" text-anchor="middle" font-family="${font}" font-size="54" fill="${home ? palette.accent : palette.ink}">${escapeXml(name)}</text>`,
    );
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
