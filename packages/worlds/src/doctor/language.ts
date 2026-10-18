import type { Point } from "../camera";
import type { Phrases, Readout, ReadoutInput, StillMap } from "../types";
import { helipadRadius, mainBlock, practiceBlock } from "./buildings";
import { doctorPalette as palette, doctorShades as shade } from "./palette";
import {
  bayDistance,
  driveWidth,
  hospitalReach,
  mainRoadWidth,
  outwardOf,
  ringRoad,
  spokeOf,
} from "./streets";

/** The log reads like a calm dispatch desk: who, where, then the note. */
export const doctorPhrases: Phrases = {
  message: (from, to, text) => `Dispatched from ${from} to ${to}: ${text}`,
  external: (source, record, text) =>
    `Air ambulance from ${source}, for ${record}: ${text}`,
  status: (agent, was, now, text) =>
    `${agent} now ${now} (was ${was}). ${text}`,
  answered: (decision, where) =>
    `Results back at ${where}. Diagnosis recorded: ${decision}`,
};

export function doctorReadout(input: ReadoutInput): Readout {
  return {
    title: "Medical district, by night",
    lines: [
      `${input.clients} hospitals · ${input.agents} staff · ${input.active} on rounds or monitoring`,
      `Dispatch board ${input.time} · zoom ${input.scale.toFixed(2)}`,
    ],
    attention: `${input.needsYou} need your sign-off · ${input.openQuestions} test results pending`,
  };
}

const accent = palette.accent;

function path(points: Point[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
}

function road(points: Point[], width: number, colour: string): string {
  return `<path d="${path(points)}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="square" stroke-linejoin="miter"/>`;
}

function block(
  centre: Point,
  half: { width: number; height: number },
  radius: number,
): string {
  return `<rect x="${centre.x - half.width}" y="${centre.y - half.height}" width="${half.width * 2}" height="${half.height * 2}" rx="${radius}" fill="${shade.roof}" stroke="${accent}" stroke-opacity="0.75" stroke-width="4"/>`;
}

/** The plain H of a helipad: three bars, never a cross. */
function helipad(centre: Point): string {
  const { x, y } = centre;
  return (
    `<circle cx="${x}" cy="${y}" r="${helipadRadius}" fill="${shade.helipad}" stroke="${palette.ink}" stroke-opacity="0.6" stroke-width="4"/>` +
    `<path d="M${x - 8} ${y - 13}V${y + 13}M${x + 8} ${y - 13}V${y + 13}M${x - 8} ${y}H${x + 8}" stroke="${palette.ink}" stroke-opacity="0.8" stroke-width="4" fill="none"/>`
  );
}

function grounds(centre: Point, reach: number): string {
  return `<rect x="${centre.x - reach}" y="${centre.y - reach}" width="${reach * 2}" height="${reach * 2}" rx="14" fill="${shade.grounds}" stroke="${accent}" stroke-opacity="0.3" stroke-width="3"/>`;
}

/**
 * The still map draws the same main roads as the live one: the ring around
 * The Practice, and each hospital's spoke, worked out from its centre.
 */
export const doctorStillMap: StillMap = {
  home: (centre) => {
    const spoke = spokeOf(centre, true);
    const [bay, end] = spoke.drive;
    return (
      grounds(centre, 350) +
      road(ringRoad(), mainRoadWidth, shade.mainRoad) +
      road([bay, end], driveWidth, shade.street) +
      `<rect x="${bay.x - 64}" y="${bay.y - 50}" width="142" height="100" rx="6" fill="${shade.street}"/>` +
      block(centre, practiceBlock, 8) +
      `<rect x="${centre.x - 92}" y="${centre.y + 70}" width="184" height="40" rx="6" fill="${shade.signPlate}" stroke="#ffffff" stroke-opacity="0.8" stroke-width="2"/>`
    );
  },
  client: (centre) => {
    const spoke = spokeOf(centre, false);
    const [bay, end] = spoke.drive;
    const outward = outwardOf(centre, false);
    const wings = [-1.2, 0, 1.2]
      .map((turn) => {
        const angle = outward + turn;
        const x = centre.x + Math.cos(angle) * bayDistance;
        const y = centre.y + Math.sin(angle) * bayDistance;
        return (
          `<path d="M${centre.x} ${centre.y}L${x.toFixed(1)} ${y.toFixed(1)}" stroke="${shade.roof}" stroke-width="34"/>` +
          `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="74" fill="${shade.floor}" stroke="${accent}" stroke-opacity="0.7" stroke-width="4"/>`
        );
      })
      .join("");
    return (
      grounds(centre, hospitalReach) +
      road(spoke.road, mainRoadWidth, shade.mainRoad) +
      road([bay, end], driveWidth, shade.street) +
      `<path d="M${centre.x} ${centre.y}L${bay.x.toFixed(1)} ${bay.y.toFixed(1)}" stroke="${shade.roof}" stroke-width="18"/>` +
      wings +
      block(centre, mainBlock, 12) +
      helipad(centre) +
      `<rect x="${(bay.x - 30).toFixed(1)}" y="${(bay.y - 30).toFixed(1)}" width="60" height="60" rx="6" fill="${shade.street}" stroke="${accent}" stroke-opacity="0.6" stroke-width="3"/>`
    );
  },
  labelOffset: -hospitalReach - 24,
};
