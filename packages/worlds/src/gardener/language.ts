import type { Phrases, Readout, ReadoutInput, StillMap } from "../types";
import { bedPath, yardSize } from "./beds";
import { gardenerPalette, washes } from "./palette";

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

/** The cottage roof, as a small hipped rectangle. */
const cottage = (x: number, y: number) =>
  `<rect x="${x - 40}" y="${y - 30}" width="80" height="56" rx="3" fill="${washes.terracotta}" stroke="${gardenerPalette.ink}" stroke-width="3"/>` +
  `<path d="M${x - 40} ${y - 30}L${x - 16} ${y - 2}L${x + 16} ${y - 2}L${x + 40} ${y - 30}M${x - 40} ${y + 26}L${x - 16} ${y - 2}M${x + 16} ${y - 2}L${x + 40} ${y + 26}" fill="none" stroke="${washes.terracottaDeep}" stroke-width="2.5"/>`;

export const gardenerStillMap: StillMap = {
  home: (centre, id) =>
    `<path d="${bedPath(id, centre, yardSize, 0, 6)}" fill="${washes.lawn}" fill-opacity="0.45" stroke="${washes.wood}" stroke-width="5" stroke-dasharray="3 9"/>` +
    cottage(centre.x, centre.y) +
    `<circle cx="${centre.x - 70}" cy="${centre.y + 48}" r="14" fill="${washes.water}" stroke="${washes.stone}" stroke-width="5"/>`,
  client: (centre, id) =>
    `<path d="${bedPath(id, centre)}" fill="${washes.soil}" fill-opacity="0.5" stroke="${washes.hedge}" stroke-width="16" stroke-opacity="0.85"/>` +
    `<circle cx="${centre.x}" cy="${centre.y}" r="22" fill="${washes.straw}" stroke="${washes.strawDeep}" stroke-width="3"/>`,
  labelOffset: -372,
};
