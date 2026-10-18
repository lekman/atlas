import type { Phrases, Readout, ReadoutInput, StillMap } from "../types";
import { castleSvg, dayCastle, nightCastle } from "./castle";
import { crestFor, traceCrest } from "./crest";
import {
  samuraiDecoration as decoration,
  samuraiNightDecoration as night,
} from "./palette";
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

/** The still map's colours by day, and by night (Ninja). */
const stillColours = {
  day: {
    shadow: decoration.sumi,
    leaf: decoration.gold,
    line: decoration.sumi,
    crestGround: decoration.paper,
    crest: decoration.sumi,
    castle: dayCastle,
  },
  night: {
    shadow: "#000000",
    leaf: night.silver,
    line: night.silver,
    crestGround: "#1d2333",
    crest: "#d8dde7",
    castle: nightCastle,
  },
} as const;

export const samuraiStillMap: StillMap = {
  // The keep is drawn larger here than on the live map, where it has
  // petals and pines around it to hold the eye. By night its windows and
  // the two lanterns at its gate are lit.
  home: (centre, _id, lighting = "day") => {
    const colours = stillColours[lighting];
    return (
      `<g transform="translate(${centre.x} ${centre.y}) scale(1.6)">` +
      `<ellipse cx="0" cy="38" rx="96" ry="14" fill="${colours.shadow}" fill-opacity="${lighting === "night" ? 0.3 : 0.14}"/>` +
      `<rect x="-112" y="-70" width="150" height="22" rx="11" fill="${colours.leaf}" fill-opacity="0.35"/>` +
      `<rect x="-6" y="-6" width="118" height="16" rx="8" fill="${colours.leaf}" fill-opacity="0.3"/>` +
      castleSvg({ x: 0, y: 0 }, 1, colours.castle) +
      `</g>`
    );
  },
  // By night each clan's province has its lantern lit, on the side that
  // faces The Castle, as on the live map.
  client: (centre, id, lighting = "day") => {
    const colours = stillColours[lighting];
    const pen = new SvgPen();
    traceCrest(pen, crestFor(id), centre, 42);
    const homeward = Math.atan2(centre.y, centre.x) + Math.PI;
    const lantern = {
      x: Math.round(centre.x + Math.cos(homeward) * 150),
      y: Math.round(centre.y + Math.sin(homeward) * 150),
    };
    // A tall paper lantern between dark caps, hung from a short cord: a
    // shape no status dot has.
    const lit =
      lighting === "night"
        ? `<path d="M${lantern.x} ${lantern.y - 24}V${lantern.y - 13}" stroke="${night.silver}" stroke-width="2"/>` +
          `<ellipse cx="${lantern.x}" cy="${lantern.y}" rx="9" ry="12" fill="${night.lantern}"/>` +
          `<ellipse cx="${lantern.x}" cy="${lantern.y + 1}" rx="4.5" ry="6.5" fill="${night.flame}"/>` +
          `<rect x="${lantern.x - 6}" y="${lantern.y - 14}" width="12" height="3.5" fill="${night.sumi}"/>` +
          `<rect x="${lantern.x - 6}" y="${lantern.y + 10.5}" width="12" height="3.5" fill="${night.sumi}"/>`
        : "";
    return (
      `<circle cx="${centre.x}" cy="${centre.y}" r="172" fill="${colours.line}" fill-opacity="0.05"/>` +
      `<circle cx="${centre.x}" cy="${centre.y}" r="132" fill="none" stroke="${colours.line}" stroke-opacity="0.5" stroke-width="6" stroke-dasharray="690 140" stroke-linecap="round"/>` +
      `<circle cx="${centre.x}" cy="${centre.y}" r="49" fill="${colours.crestGround}" stroke="${colours.line}" stroke-opacity="0.3" stroke-width="2"/>` +
      `<path d="${pen.take()}" fill="${colours.crest}" fill-rule="evenodd"/>` +
      lit
    );
  },
  labelOffset: 205,
};
