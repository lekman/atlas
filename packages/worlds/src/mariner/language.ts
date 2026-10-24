import type { Point } from "../camera";
import type {
  Lighting,
  Phrases,
  Readout,
  ReadoutInput,
  StillMap,
} from "../types";
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

/** Shallows and land for the still map: sand on paper by day, slate on navy by night. */
function island(
  id: string,
  centre: Point,
  radius: number,
  lighting: Lighting = "day",
): string {
  const [shallows, opacity, land, coast] =
    lighting === "night"
      ? ["#3c6996", "0.35", "#2b3036", "#b9c4cf"]
      : ["#c9dde3", "0.45", "#e7d29b", "#5a3f22"];
  return (
    `<path d="${coastPath(id, centre, 70, radius)}" fill="${shallows}" fill-opacity="${opacity}"/>` +
    `<path d="${coastPath(id, centre, 0, radius)}" fill="${land}" stroke="${coast}" stroke-width="3"/>`
  );
}

/** A warm light seen from far off: a soft halo and a bright point. Never a status hue. */
const stillLight = (x: number, y: number, size: number) =>
  `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size * 4}" fill="#fff0cc" fill-opacity="0.18"/>` +
  `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size}" fill="#fff8e6"/>`;

export const marinerStillMap: StillMap = {
  home: (centre, id, lighting) =>
    island(id, centre, homeRadius, lighting) +
    (lighting === "night"
      ? // Turtle Bay after dark: the pier light and a few lit windows.
        stillLight(centre.x - 4, centre.y - homeRadius * 0.62, 6) +
        stillLight(centre.x - 20, centre.y + 6, 3) +
        stillLight(centre.x + 8, centre.y + 8, 3) +
        stillLight(centre.x + 2, centre.y + 26, 3)
      : ""),
  client: (centre, id, lighting) => island(id, centre, islandRadius, lighting),
  labelOffset: 150,
  // A fishing line to a float riding beside the cargo.
  work: (from, task, lighting = "day") => {
    const [line, float] =
      lighting === "night" ? ["#aaa392", "#d9dde0"] : ["#3d2a17", "#f6efde"];
    const angle = Math.atan2(from.y - task.y, from.x - task.x);
    const x = (task.x + Math.cos(angle) * 18).toFixed(1);
    const y = (task.y + Math.sin(angle) * 18).toFixed(1);
    return (
      `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${x}" y2="${y}" stroke="${line}" stroke-width="2.5"/>` +
      `<circle cx="${x}" cy="${y}" r="7" fill="${float}" stroke="${line}" stroke-width="2"/>`
    );
  },
};
