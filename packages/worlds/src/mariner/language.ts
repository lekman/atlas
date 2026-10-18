import type { Phrases, Readout, ReadoutInput, StillMap } from "../types";
import { coastPath, islandRadius } from "./coast";

/** The log reads like a log book: sentences, quotation marks, italics in the view. */
export const marinerPhrases: Phrases = {
  message: (from, to, text) => `Signal from ${from} to ${to}: “${text}”`,
  external: (source, record, text) =>
    `Telegram from ${source}, for ${record}: ${text}`,
  status: (agent, _was, now, text) => `${agent} now ${now}: ${text}`,
  answered: (decision, where) =>
    `Fog lifts over ${where}. Lighthouse lit: ${decision}`,
};

export function marinerReadout(input: ReadoutInput): Readout {
  return {
    title: "Chart of present work",
    lines: [
      `${input.clients} islands · ${input.agents} vessels · ${input.active} under way`,
      `Scale 1 : ${Math.round(1000 / input.scale).toLocaleString("en-GB")} · ${input.time}`,
    ],
    attention: `${input.needsYou} awaiting your orders · ${input.openQuestions} fog banks`,
  };
}

const homeRadius = 70;

export const marinerStillMap: StillMap = {
  home: (centre, id) =>
    `<path d="${coastPath(id, centre, 70, homeRadius)}" fill="#c9dde3" fill-opacity="0.45"/>` +
    `<path d="${coastPath(id, centre, 0, homeRadius)}" fill="#e7d29b" stroke="#5a3f22" stroke-width="3"/>`,
  client: (centre, id) =>
    `<path d="${coastPath(id, centre, 70, islandRadius)}" fill="#c9dde3" fill-opacity="0.45"/>` +
    `<path d="${coastPath(id, centre, 0, islandRadius)}" fill="#e7d29b" stroke="#5a3f22" stroke-width="3"/>`,
  labelOffset: 150,
};
