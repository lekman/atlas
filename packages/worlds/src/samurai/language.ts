import type { Phrases, Readout, ReadoutInput, StillMap } from "../types";
import { castleSvg } from "./castle";
import { crestFor, traceCrest } from "./crest";
import { samuraiDecoration as decoration } from "./palette";
import { SvgPen } from "./pen";

/** The chronicle is plain and measured: who, what, and the words carried. */
export const samuraiPhrases: Phrases = {
  message: (from, to, text) => `Messenger from ${from} to ${to}: “${text}”`,
  external: (source, record, text) =>
    `Courier from ${source}, for ${record}: ${text}`,
  status: (agent, _was, now, text) => `${agent}, now ${now}: ${text}`,
  answered: (decision, where) =>
    `The report from ${where} is opened. Sealed: ${decision}`,
};

export function samuraiReadout(input: ReadoutInput): Readout {
  return {
    title: "The campaign scroll",
    lines: [
      `${input.clients} clans · ${input.agents} retainers · ${input.active} on campaign`,
      `Unrolled to ${Math.round(input.scale * 100)} percent · ${input.time}`,
    ],
    attention: `${input.needsYou} awaiting your command · ${input.openQuestions} reports awaited`,
  };
}

export const samuraiStillMap: StillMap = {
  // The keep is drawn larger here than on the live map, where it has
  // petals and pines around it to hold the eye.
  home: (centre) =>
    `<g transform="translate(${centre.x} ${centre.y}) scale(1.6)">` +
    `<ellipse cx="0" cy="38" rx="96" ry="14" fill="${decoration.sumi}" fill-opacity="0.14"/>` +
    `<rect x="-112" y="-70" width="150" height="22" rx="11" fill="${decoration.gold}" fill-opacity="0.35"/>` +
    `<rect x="-6" y="-6" width="118" height="16" rx="8" fill="${decoration.gold}" fill-opacity="0.3"/>` +
    castleSvg({ x: 0, y: 0 }) +
    `</g>`,
  client: (centre, id) => {
    const pen = new SvgPen();
    traceCrest(pen, crestFor(id), centre, 42);
    return (
      `<circle cx="${centre.x}" cy="${centre.y}" r="172" fill="${decoration.sumi}" fill-opacity="0.05"/>` +
      `<circle cx="${centre.x}" cy="${centre.y}" r="132" fill="none" stroke="${decoration.sumi}" stroke-opacity="0.5" stroke-width="6" stroke-dasharray="690 140" stroke-linecap="round"/>` +
      `<circle cx="${centre.x}" cy="${centre.y}" r="49" fill="${decoration.paper}" stroke="${decoration.sumi}" stroke-opacity="0.3" stroke-width="2"/>` +
      `<path d="${pen.take()}" fill="${decoration.sumi}" fill-rule="evenodd"/>`
    );
  },
  labelOffset: 205,
};
