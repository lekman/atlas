import type { Phrases, Readout, ReadoutInput, StillMap } from "../types";

/** The log reads like a ship's console: upper case, arrows, double colons. */
export const astronomerPhrases: Phrases = {
  message: (from, to, text) =>
    `BEAM ${from.toUpperCase()} → ${to.toUpperCase()} :: ${text}`,
  external: (source, record, text) =>
    `INBOUND // ${source.toUpperCase()} → ${record.toUpperCase()} :: ${text}`,
  status: (agent, was, now, text) =>
    `${agent.toUpperCase()} ${was.toUpperCase()} → ${now.toUpperCase()} :: ${text}`,
  answered: (decision) =>
    `COMET RESOLVED :: CHARTED “${decision.toUpperCase()}”`,
  launched: (vessel, parent, task, text) =>
    `LAUNCH ${vessel.toUpperCase()} FROM ${parent.toUpperCase()} → ${task ? task.toUpperCase() : "HOLDING"} :: ${text}`,
  returned: (vessel, parent, text) =>
    `LAUNCH ${vessel.toUpperCase()} DOCKED → ${parent.toUpperCase()} :: ${text}`,
};

export function astronomerReadout(input: ReadoutInput): Readout {
  return {
    lines: [
      `X ${(input.x / 1000).toFixed(3)}  Y ${(input.y / 1000).toFixed(3)}  ZOOM ${input.scale.toFixed(2)}`,
      `${input.clients} SYSTEMS · ${input.agents} PROBES · ${input.active} UNDERWAY`,
      `${input.time} · LOCAL DATABASE · TAILNET ONLY`,
    ],
    attention: `${input.needsYou} HAILING YOU · ${input.openQuestions} COMETS TRACKED`,
  };
}

export const astronomerStillMap: StillMap = {
  home: (centre) =>
    `<circle cx="${centre.x}" cy="${centre.y}" r="64" fill="#78beff" fill-opacity="0.18"/>` +
    `<circle cx="${centre.x}" cy="${centre.y}" r="34" fill="#2d6fae" stroke="#a0dcff" stroke-width="2"/>`,
  client: (centre) =>
    `<circle cx="${centre.x}" cy="${centre.y}" r="90" fill="#ffc878" fill-opacity="0.25"/>` +
    `<circle cx="${centre.x}" cy="${centre.y}" r="12" fill="#fff4dc"/>` +
    `<circle cx="${centre.x}" cy="${centre.y}" r="330" fill="none" stroke="#5edcff" stroke-opacity="0.15" stroke-width="3" stroke-dasharray="8 16"/>`,
  labelOffset: -250,
  // A mining laser, still: a soft cyan glow round a bright core.
  work: (from, task) =>
    `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${task.x.toFixed(1)}" y2="${task.y.toFixed(1)}" stroke="#5edcff" stroke-opacity="0.3" stroke-width="10" stroke-linecap="round"/>` +
    `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${task.x.toFixed(1)}" y2="${task.y.toFixed(1)}" stroke="#e9fdff" stroke-width="3" stroke-linecap="round"/>`,
};
