import type { Point } from "../camera";
import type { Phrases, Readout, ReadoutInput, StillMap } from "../types";
import { bedPath, bedRadius, bedSize, yardSize } from "./beds";
import { gardenLook, lanternLight, type GardenLook } from "./palette";

/** The diary reads like a gardener's notebook: plain sentences, what happened where. */
export const gardenerPhrases: Phrases = {
  message: (from, to, text) => `Pollen from ${from} to ${to}: “${text}”`,
  external: (source, record, text) =>
    `Weather from ${source} over ${record}: ${text}`,
  status: (agent, _was, now, text) => `${agent} is ${now}: ${text}`,
  answered: (decision, where) =>
    `A dandelion clock blown at ${where}. New trellis: ${decision}`,
};

export function gardenerReadout(input: ReadoutInput): Readout {
  return {
    title: "Planting plan",
    lines: [
      `${input.clients} beds · ${input.agents} bees · ${input.active} tending`,
      `Drawn at 1 : ${Math.round(100 / input.scale).toLocaleString("en-GB")} · ${input.time}`,
    ],
    attention: `${input.needsYou} waiting for you · ${input.openQuestions} dandelion clocks`,
  };
}

/** The cottage roof, as a small hipped rectangle; at night its windows are lit. */
const cottage = (x: number, y: number, look: GardenLook) =>
  `<rect x="${x - 40}" y="${y - 30}" width="80" height="56" rx="3" fill="${look.washes.terracotta}" stroke="${look.palette.ink}" stroke-width="3"${look.night ? ' stroke-opacity="0.6"' : ""}/>` +
  `<path d="M${x - 40} ${y - 30}L${x - 16} ${y - 2}L${x + 16} ${y - 2}L${x + 40} ${y - 30}M${x - 40} ${y + 26}L${x - 16} ${y - 2}M${x + 16} ${y - 2}L${x + 40} ${y + 26}" fill="none" stroke="${look.washes.terracottaDeep}" stroke-width="2.5"/>` +
  (look.night
    ? (
        [
          [x - 24, y + 30],
          [x + 24, y + 30],
          [x - 20, y - 34],
          [x + 20, y - 34],
        ] as const
      )
        .map(
          ([wx, wy]) =>
            `<circle cx="${wx}" cy="${wy}" r="22" fill="${lanternLight.glow}" fill-opacity="0.3"/>` +
            `<rect x="${wx - 6}" y="${wy - 2}" width="12" height="4" fill="${lanternLight.paper}"/>`,
        )
        .join("")
    : "");

/**
 * A bed's soil on the still map at night. With no lawn under it, as the live
 * map has, the soil is laid a little lighter than the ground so beds stand out.
 */
const nightSoil = "#29261f";

/** A lantern seen from far off: a soft pool of light and its bright lamp. */
const lantern = ({ x, y }: Point) =>
  `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="58" fill="${lanternLight.glow}" fill-opacity="0.16"/>` +
  `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="28" fill="${lanternLight.glow}" fill-opacity="0.3"/>` +
  `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="${lanternLight.paper}" stroke="${lanternLight.frame}" stroke-width="2"/>`;

/** The pair of lanterns at a bed's entrance, on the side that faces home. */
function entrance(centre: Point, id: string): string {
  const angle = Math.atan2(-centre.y, -centre.x);
  const reach = bedRadius(id, angle, bedSize, 8) - 36;
  const along = { x: Math.cos(angle), y: Math.sin(angle) };
  return [-1, 1]
    .map((side) =>
      lantern({
        x: centre.x + along.x * reach - along.y * side * 45,
        y: centre.y + along.y * reach + along.x * side * 45,
      }),
    )
    .join("");
}

export const gardenerStillMap: StillMap = {
  home: (centre, id, lighting = "day") => {
    const look = gardenLook(lighting);
    const { washes } = look;
    return (
      `<path d="${bedPath(id, centre, yardSize, 0, 6)}" fill="${washes.lawn}" fill-opacity="0.45" stroke="${washes.wood}" stroke-width="5" stroke-dasharray="3 9"/>` +
      cottage(centre.x, centre.y, look) +
      `<circle cx="${centre.x - 70}" cy="${centre.y + 48}" r="14" fill="${washes.water}" stroke="${washes.stone}" stroke-width="5"/>` +
      (look.night ? lantern({ x: centre.x + 20, y: centre.y + 48 }) : "")
    );
  },
  client: (centre, id, lighting = "day") => {
    const look = gardenLook(lighting);
    const { washes } = look;
    return (
      `<path d="${bedPath(id, centre)}" fill="${look.night ? nightSoil : washes.soil}" fill-opacity="${look.night ? 0.85 : 0.5}" stroke="${washes.hedge}" stroke-width="16" stroke-opacity="0.85"/>` +
      (look.night
        ? `<path d="${bedPath(id, centre, bedSize, 4)}" fill="none" stroke="${washes.hedgeLight}" stroke-width="3" stroke-opacity="0.35"/>` +
          entrance(centre, id)
        : "") +
      `<circle cx="${centre.x}" cy="${centre.y}" r="22" fill="${washes.straw}" stroke="${washes.strawDeep}" stroke-width="3"/>`
    );
  },
  labelOffset: -372,
};
