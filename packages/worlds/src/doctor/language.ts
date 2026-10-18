import type { Phrases, Readout, ReadoutInput, StillMap } from "../types";

/** The log reads like a calm handover: who, what, then the note. */
export const doctorPhrases: Phrases = {
  message: (from, to, text) => `Page from ${from} to ${to}: ${text}`,
  external: (source, record, text) =>
    `Lab feed from ${source}, for ${record}: ${text}`,
  status: (agent, was, now, text) =>
    `${agent} now ${now} (was ${was}). ${text}`,
  answered: (decision, where) =>
    `Result back for ${where}. Diagnosis recorded: ${decision}`,
};

export function doctorReadout(input: ReadoutInput): Readout {
  return {
    title: "Ward board",
    lines: [
      `${input.clients} wards · ${input.agents} staff · ${input.active} on rounds or monitoring`,
      `Board updated ${input.time} · zoom ${input.scale.toFixed(2)}`,
    ],
    attention: `${input.needsYou} need your sign-off · ${input.openQuestions} lab results pending`,
  };
}

const wall = "#7ad6cf";
const floor = "#0b2126";

function room(x: number, y: number, halfWidth: number, halfHeight: number) {
  return `<rect x="${x - halfWidth}" y="${y - halfHeight}" width="${halfWidth * 2}" height="${halfHeight * 2}" rx="30" fill="${floor}" stroke="${wall}" stroke-opacity="0.5" stroke-width="4"/>`;
}

/** A stylised trace for a ward's monitor strip: a few beats, no values. */
function trace(x: number, y: number, width: number): string {
  const beats = 4;
  const step = width / beats;
  let path = `M${x} ${y}`;
  for (let index = 0; index < beats; index++) {
    const start = x + index * step;
    path +=
      ` L${start + step * 0.25} ${y}` +
      ` L${start + step * 0.3} ${y + 6}` +
      ` L${start + step * 0.35} ${y - 34}` +
      ` L${start + step * 0.4} ${y + 10}` +
      ` L${start + step * 0.45} ${y}` +
      ` L${start + step} ${y}`;
  }
  return `<path d="${path}" fill="none" stroke="${wall}" stroke-opacity="0.6" stroke-width="4" stroke-linejoin="round"/>`;
}

export const doctorStillMap: StillMap = {
  home: (centre) =>
    room(centre.x, centre.y, 220, 260) +
    `<path d="M${centre.x - 66} ${centre.y + 36} V${centre.y - 12} Q${centre.x - 66} ${centre.y - 38} ${centre.x - 40} ${centre.y - 38} H${centre.x + 40} Q${centre.x + 66} ${centre.y - 38} ${centre.x + 66} ${centre.y - 12} V${centre.y + 36}" fill="none" stroke="#123238" stroke-width="20" stroke-linecap="round"/>` +
    `<path d="M${centre.x - 66} ${centre.y + 36} V${centre.y - 12} Q${centre.x - 66} ${centre.y - 38} ${centre.x - 40} ${centre.y - 38} H${centre.x + 40} Q${centre.x + 66} ${centre.y - 38} ${centre.x + 66} ${centre.y - 12} V${centre.y + 36}" fill="none" stroke="${wall}" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>`,
  client: (centre) =>
    room(centre.x, centre.y, 300, 300) +
    trace(centre.x - 260, centre.y - 240, 520) +
    `<rect x="${centre.x - 22}" y="${centre.y - 16}" width="44" height="32" rx="8" fill="none" stroke="${wall}" stroke-opacity="0.35" stroke-width="3"/>`,
  labelOffset: -330,
};
