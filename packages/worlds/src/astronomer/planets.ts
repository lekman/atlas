/**
 * How each workstream's planet looks round a client's star: its colour, its
 * size and whether it wears a ring. Each look comes from a hash of the
 * workstream's id, so a planet keeps its look across reloads and on every
 * machine, with no stored state.
 */
import { hashString, seededRandom } from "../random";

/**
 * The colours a planet can take. Each one shows at 3.6:1 or more on the
 * Astronomer ground (#04070d), so a planet reads as a solid body. Measured
 * as CIE76 colour difference, each stays 27 or more from every status
 * colour, the cyan accent and the requirement planets' blue, so a planet
 * never reads as a status, and 20 or more from every other planet colour.
 * `tests/planets.test.ts` holds the palette to those numbers.
 */
export const planetColours = [
  "#b49cf0", // lilac
  "#d27fd0", // orchid
  "#e8949f", // rose
  "#c97b4f", // copper
  "#d6be8a", // sand
  "#9aa05a", // olive
  "#4e9e95", // teal
  "#8a5296", // plum
  "#6672d8", // indigo
  "#a07258", // umber
  "#e4dccb", // ivory
] as const;

export interface PlanetLook {
  /** One of `planetColours`. */
  colour: string;
  /** Its radius as a share of the usual planet's: 0.85 to 1.15. */
  size: number;
  /** The tilt of its ring in radians, or null for a planet without a ring. */
  ring: number | null;
}

/** About one planet in three wears a ring. */
const ringShare = 0.35;

/**
 * The look of each workstream's planet in one system, keyed by workstream
 * id. Each planet starts at the palette colour its hash picks and walks on
 * past colours already taken in the system, so no two planets in a system
 * share a colour while the palette has room. Past eleven planets the
 * palette starts again. Give the ids in the order the system draws them,
 * so a planet's colour changes only when a planet before it is added.
 */
export function planetLooks(
  workstreamIds: readonly string[],
): Map<string, PlanetLook> {
  const looks = new Map<string, PlanetLook>();
  const taken = new Set<number>();
  for (const id of workstreamIds) {
    if (looks.has(id)) continue;
    if (taken.size === planetColours.length) taken.clear();
    const hash = hashString(id);
    let index = hash % planetColours.length;
    while (taken.has(index)) index = (index + 1) % planetColours.length;
    taken.add(index);
    const random = seededRandom(hash);
    const size = 0.85 + random() * 0.3;
    const ringed = random() < ringShare;
    const tilt = (random() - 0.5) * 0.8;
    looks.set(id, {
      colour: planetColours[index] ?? planetColours[0],
      size,
      ring: ringed ? tilt : null,
    });
  }
  return looks;
}

/** `hex` moved `share` of the way towards `toward`, as `#rrggbb`. */
export function mixColour(hex: string, toward: string, share: number): string {
  const parts = (colour: string) => {
    const value = Number.parseInt(colour.slice(1, 7), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const from = parts(hex);
  const to = parts(toward);
  return `#${from
    .map((part, index) =>
      Math.round(part + ((to[index] ?? part) - part) * share)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
