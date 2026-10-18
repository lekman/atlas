import type { Phrases, Readout, ReadoutInput, StillMap } from "../types";
import { clearingRadius, homeClearingRadius, outlinePath } from "./terrain";

/** The log reads like field notes: short, plain, a little weathered. */
export const woodsmanPhrases: Phrases = {
  message: (from, to, text) => `Bird call from ${from} to ${to}: “${text}”`,
  external: (source, record, text) =>
    `Runner from ${source}, with word of ${record}: ${text}`,
  status: (agent, _was, now, text) => `${agent}, now ${now}: ${text}`,
  answered: (decision, where) =>
    `The fork at ${where} is marked. Tree blazed: ${decision}`,
};

export function woodsmanReadout(input: ReadoutInput): Readout {
  return {
    title: "Trail map of present work",
    lines: [
      `${input.clients} clearings · ${input.agents} scouts, ${input.active} afield`,
      `Scale 1 : ${Math.round(1000 / input.scale).toLocaleString("en-GB")} · ${input.time}`,
    ],
    attention: `${input.needsYou} waiting for you · ${input.openQuestions} unmarked forks`,
  };
}

const woodland = "#d6dfc0";
const clearing = "#f7f4e6";
const contour = "#a77d52";
const edge = "#3b2a1a";

function contours(id: string, centre: { x: number; y: number }, base: number) {
  return [1, 2, 3, 4]
    .map(
      (ring) =>
        `<path d="${outlinePath(id, centre, base + 28 + ring * 40, ring)}" fill="none" stroke="${contour}" stroke-opacity="0.6" stroke-width="${ring === 4 ? 4 : 2}"/>`,
    )
    .join("");
}

function tent(x: number, y: number): string {
  return `<path d="M${x},${y - 22}L${x + 18},${y + 10}L${x - 18},${y + 10}Z" fill="#e9dcb8" stroke="${edge}" stroke-width="3"/>`;
}

export const woodsmanStillMap: StillMap = {
  home: (centre, id) =>
    `<circle cx="${centre.x}" cy="${centre.y}" r="${homeClearingRadius + 200}" fill="${woodland}" fill-opacity="0.7"/>` +
    contours(id, centre, homeClearingRadius) +
    `<path d="${outlinePath(id, centre, homeClearingRadius)}" fill="${clearing}" stroke="${edge}" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>` +
    tent(centre.x - 44, centre.y - 24) +
    tent(centre.x, centre.y - 50) +
    tent(centre.x + 44, centre.y - 24) +
    `<circle cx="${centre.x}" cy="${centre.y + 6}" r="10" fill="#e0781c"/>`,
  client: (centre, id) =>
    `<circle cx="${centre.x}" cy="${centre.y}" r="${clearingRadius + 220}" fill="${woodland}" fill-opacity="0.7"/>` +
    contours(id, centre, clearingRadius) +
    `<path d="${outlinePath(id, centre, clearingRadius)}" fill="${clearing}" stroke="${edge}" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>`,
  labelOffset: 200,
};
