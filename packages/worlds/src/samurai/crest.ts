/**
 * Clan crests, invented. Each is a simple geometric figure built from the
 * client's id: a ring, and inside it a motif repeated with rotational
 * symmetry. None copies a real family crest: the motifs are plain geometry
 * (spokes, segments, chevrons, beads, bars), never flowers, leaves, commas
 * or a known arrangement, and four-fold symmetry is left out altogether.
 *
 * Shapes are in unit space (radius 1) and are filled together with the
 * even-odd rule, so a ring is two circles and nothing else overlaps.
 */
import type { Point } from "../camera";
import { hashString, seededRandom } from "../random";
import type { Pen } from "./pen";

export type CrestShape =
  | { kind: "circle"; x: number; y: number; radius: number }
  | { kind: "polygon"; points: Point[] };

export type CrestMotif = "spokes" | "segments" | "chevrons" | "beads" | "bars";

const motifs: CrestMotif[] = [
  "spokes",
  "segments",
  "chevrons",
  "beads",
  "bars",
];

const symmetry: Record<CrestMotif, number[]> = {
  spokes: [5, 6, 7],
  segments: [3, 5, 6],
  chevrons: [5, 6, 7],
  beads: [5, 7],
  bars: [3, 5, 6],
};

export interface Crest {
  motif: CrestMotif;
  folds: number;
  shapes: CrestShape[];
}

const cache = new Map<string, Crest>();

export function crestFor(id: string): Crest {
  const known = cache.get(id);
  if (known) return known;
  const hash = hashString(`clan:${id}`);
  const random = seededRandom(hash);
  const motif = motifs[(hash >>> 8) % motifs.length] ?? "spokes";
  const choices = symmetry[motif];
  const folds = choices[Math.floor(random() * choices.length)] ?? 5;
  const turn = -Math.PI / 2 + (random() < 0.5 ? 0 : Math.PI / folds);
  const doubleFrame = random() < 0.5;

  const shapes: CrestShape[] = doubleFrame
    ? [
        circle(0, 0, 1),
        circle(0, 0, 0.94),
        circle(0, 0, 0.89),
        circle(0, 0, 0.84),
      ]
    : [circle(0, 0, 1), circle(0, 0, 0.87)];

  for (let fold = 0; fold < folds; fold++) {
    const angle = turn + (fold * Math.PI * 2) / folds;
    shapes.push(...motifShapes(motif, angle, folds));
  }
  shapes.push(...centreShapes(motif, turn, folds));

  const crest = { motif, folds, shapes };
  cache.set(id, crest);
  return crest;
}

function circle(x: number, y: number, radius: number): CrestShape {
  return { kind: "circle", x, y, radius };
}

function at(angle: number, radius: number): Point {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function motifShapes(
  motif: CrestMotif,
  angle: number,
  folds: number,
): CrestShape[] {
  const slice = (Math.PI * 2) / folds;
  switch (motif) {
    case "spokes": {
      const half = slice * 0.2;
      return [
        {
          kind: "polygon",
          points: [
            at(angle, 0.24),
            at(angle - half, 0.5),
            at(angle, 0.76),
            at(angle + half, 0.5),
          ],
        },
      ];
    }
    case "segments": {
      const gap = 0.16;
      const from = angle - slice / 2 + gap;
      const to = angle + slice / 2 - gap;
      const points: Point[] = [];
      for (let step = 0; step <= 10; step++)
        points.push(at(from + ((to - from) * step) / 10, 0.74));
      for (let step = 10; step >= 0; step--)
        points.push(at(from + ((to - from) * step) / 10, 0.44));
      return [{ kind: "polygon", points }];
    }
    case "chevrons": {
      const spread = slice * 0.32;
      return [
        {
          kind: "polygon",
          points: [
            at(angle, 0.76),
            at(angle + spread, 0.5),
            at(angle + spread * 0.7, 0.44),
            at(angle, 0.62),
            at(angle - spread * 0.7, 0.44),
            at(angle - spread, 0.5),
          ],
        },
      ];
    }
    case "beads": {
      const centre = at(angle, 0.55);
      return [circle(centre.x, centre.y, 0.15)];
    }
    case "bars": {
      const distance = 0.6;
      // Short enough that a bar's ends stay well inside the ring.
      const along = Math.min(0.38, Math.tan(slice / 2) * distance * 0.78);
      const thickness = 0.08;
      const across = angle + Math.PI / 2;
      const middle = at(angle, distance);
      const corner = (side: number, depth: number) => ({
        x: middle.x + Math.cos(across) * along * side + Math.cos(angle) * depth,
        y: middle.y + Math.sin(across) * along * side + Math.sin(angle) * depth,
      });
      return [
        {
          kind: "polygon",
          points: [
            corner(-1, -thickness),
            corner(1, -thickness),
            corner(1, thickness),
            corner(-1, thickness),
          ],
        },
      ];
    }
  }
}

function centreShapes(
  motif: CrestMotif,
  turn: number,
  folds: number,
): CrestShape[] {
  switch (motif) {
    case "spokes":
      return [circle(0, 0, 0.11)];
    case "segments":
      return [circle(0, 0, 0.22)];
    case "chevrons":
      return [circle(0, 0, 0.24), circle(0, 0, 0.15)];
    case "beads":
      return [circle(0, 0, 0.26), circle(0, 0, 0.18)];
    case "bars": {
      const points: Point[] = [];
      for (let corner = 0; corner < folds; corner++)
        points.push(
          at(turn + Math.PI / folds + (corner * Math.PI * 2) / folds, 0.26),
        );
      return [{ kind: "polygon", points }];
    }
  }
}

/** Add a crest to the current path. Fill with "evenodd". */
export function traceCrest(
  pen: Pen,
  crest: Crest,
  centre: Point,
  radius: number,
): void {
  for (const shape of crest.shapes) {
    if (shape.kind === "circle") {
      const x = centre.x + shape.x * radius;
      const y = centre.y + shape.y * radius;
      pen.moveTo(x + shape.radius * radius, y);
      pen.arc(x, y, shape.radius * radius, 0, Math.PI * 2);
      pen.closePath();
    } else {
      shape.points.forEach((point, index) => {
        const x = centre.x + point.x * radius;
        const y = centre.y + point.y * radius;
        if (index === 0) pen.moveTo(x, y);
        else pen.lineTo(x, y);
      });
      pen.closePath();
    }
  }
}
