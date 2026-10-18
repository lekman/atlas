/**
 * The Castle: a three-tier keep on a battered stone base, drawn in ink. The
 * outlines are described once, through a `Pen`, so the live map and the
 * still SVG map draw the same building.
 */
import type { Point } from "../camera";
import {
  samuraiDecoration as decoration,
  samuraiNightDecoration as night,
} from "./palette";
import { SvgPen, type Pen } from "./pen";

/** The colours the keep is drawn in: by day in ink on paper, or by moonlight. */
export interface CastleColours {
  stone: string;
  plaster: string;
  /** Roofs and outlines. */
  sumi: string;
  windows: string;
  finials: string;
  timber: string;
  courses: string;
  /** A moonlit edge along each roof, so a dark roof reads on a dark ground. */
  rim?: string;
}

export const dayCastle: CastleColours = {
  stone: decoration.stone,
  plaster: decoration.plaster,
  sumi: decoration.sumi,
  windows: decoration.sumi,
  finials: decoration.gold,
  timber: "rgba(30,27,23,0.75)",
  courses: "rgba(30,27,23,0.28)",
};

/** By moonlight: pale walls, dark roofs with a silver edge, every window lit. */
export const nightCastle: CastleColours = {
  stone: night.stone,
  plaster: night.plaster,
  sumi: night.sumi,
  windows: night.lantern,
  finials: night.silver,
  timber: "rgba(7,8,13,0.8)",
  courses: "rgba(195,203,217,0.2)",
  rim: "rgba(195,203,217,0.55)",
};

/** Height of the keep above and below its centre, in world units. */
export const castleExtent = { top: 96, bottom: 38, halfWidth: 60 } as const;

interface Tier {
  /** Wall: half width, top and bottom (y, relative to the centre). */
  wall: { half: number; top: number; bottom: number };
  /** Roof: half width at the eaves and rise above the eaves. */
  roof: { half: number; rise: number };
  windows: number;
}

const tiers: Tier[] = [
  {
    wall: { half: 32, top: -24, bottom: -2 },
    roof: { half: 44, rise: 13 },
    windows: 4,
  },
  {
    wall: { half: 23, top: -52, bottom: -32 },
    roof: { half: 34, rise: 12 },
    windows: 3,
  },
  {
    wall: { half: 15, top: -78, bottom: -61 },
    roof: { half: 25, rise: 15 },
    windows: 2,
  },
];

export function traceBase(pen: Pen, centre: Point): void {
  const { x, y } = centre;
  pen.moveTo(x - 38, y - 2);
  pen.lineTo(x + 38, y - 2);
  // The stone wall leans out and sweeps wide at its foot.
  pen.quadraticCurveTo(x + 41, y + 24, x + 58, y + 38);
  pen.lineTo(x - 58, y + 38);
  pen.quadraticCurveTo(x - 41, y + 24, x - 38, y - 2);
  pen.closePath();
}

export function traceWall(pen: Pen, centre: Point, tier: Tier): void {
  const { half, top, bottom } = tier.wall;
  pen.moveTo(centre.x - half, centre.y + top);
  pen.lineTo(centre.x + half, centre.y + top);
  pen.lineTo(centre.x + half, centre.y + bottom);
  pen.lineTo(centre.x - half, centre.y + bottom);
  pen.closePath();
}

/** A roof with eaves that turn up at the tips and slopes that curve in. */
export function traceRoof(pen: Pen, centre: Point, tier: Tier): void {
  const { half, rise } = tier.roof;
  const eaves = centre.y + tier.wall.top;
  const x = centre.x;
  pen.moveTo(x - half - 5, eaves - 5);
  pen.quadraticCurveTo(x - half + 6, eaves + 1.5, x - half + 15, eaves + 1);
  pen.lineTo(x + half - 15, eaves + 1);
  pen.quadraticCurveTo(x + half - 6, eaves + 1.5, x + half + 5, eaves - 5);
  pen.quadraticCurveTo(
    x + half * 0.45,
    eaves - rise * 0.35,
    x + half * 0.3,
    eaves - rise,
  );
  pen.lineTo(x - half * 0.3, eaves - rise);
  pen.quadraticCurveTo(
    x - half * 0.45,
    eaves - rise * 0.35,
    x - half - 5,
    eaves - 5,
  );
  pen.closePath();
}

/** The small triangular gable on the middle roof. */
export function traceGable(pen: Pen, centre: Point): void {
  const tier = tiers[1];
  if (!tier) return;
  const eaves = centre.y + tier.wall.top;
  pen.moveTo(centre.x - 11, eaves - 1);
  pen.quadraticCurveTo(centre.x - 4, eaves - 6, centre.x, eaves - 11);
  pen.quadraticCurveTo(centre.x + 4, eaves - 6, centre.x + 11, eaves - 1);
  pen.closePath();
}

export function traceWindows(pen: Pen, centre: Point): void {
  for (const tier of tiers) {
    const { half, top, bottom } = tier.wall;
    const middle = centre.y + (top + bottom) / 2 + 1;
    const step = (half * 2) / (tier.windows + 1);
    for (let index = 1; index <= tier.windows; index++) {
      const x = centre.x - half + step * index;
      pen.moveTo(x - 2, middle - 2.6);
      pen.lineTo(x + 2, middle - 2.6);
      pen.lineTo(x + 2, middle + 2.6);
      pen.lineTo(x - 2, middle + 2.6);
      pen.closePath();
    }
  }
}

/** The gate in the foot of the base, and where its two lanterns hang. */
export const gate = { half: 8, top: 22, lanterns: 16, lanternY: 23 } as const;

export function traceGate(pen: Pen, centre: Point): void {
  const { x, y } = centre;
  pen.moveTo(x - gate.half, y + 38);
  pen.lineTo(x - gate.half, y + gate.top + 4);
  pen.quadraticCurveTo(x, y + gate.top - 3, x + gate.half, y + gate.top + 4);
  pen.lineTo(x + gate.half, y + 38);
  pen.closePath();
}

/** The two gold finials at the ends of the top ridge. */
export function finials(centre: Point): Point[] {
  const top = tiers[2];
  if (!top) return [];
  const y = centre.y + top.wall.top - top.roof.rise - 2;
  const spread = top.roof.half * 0.3 + 1;
  return [
    { x: centre.x - spread, y },
    { x: centre.x + spread, y },
  ];
}

/** Draw the keep in order, back to front: base, then each wall under its roof. */
export function drawCastle(
  context: CanvasRenderingContext2D,
  centre: Point,
  line: number,
  colours: CastleColours = dayCastle,
): void {
  context.lineJoin = "round";
  context.strokeStyle = colours.sumi;

  context.beginPath();
  traceBase(context, centre);
  context.fillStyle = colours.stone;
  context.fill();
  context.lineWidth = line * 1.4;
  context.stroke();
  // Courses of stone, as a few broken strokes.
  context.save();
  context.beginPath();
  traceBase(context, centre);
  context.clip();
  context.strokeStyle = colours.courses;
  context.lineWidth = line * 0.8;
  for (let course = 0; course < 4; course++) {
    const y = centre.y + 6 + course * 8.5;
    context.beginPath();
    for (let x = -60; x < 60; x += 13) {
      const shift = course % 2 ? 6 : 0;
      context.moveTo(centre.x + x + shift, y);
      context.lineTo(centre.x + x + shift + 9, y + 0.4);
    }
    context.stroke();
  }
  context.restore();

  tiers.forEach((tier, index) => {
    context.beginPath();
    traceWall(context, centre, tier);
    context.fillStyle = colours.plaster;
    context.fill();
    context.lineWidth = line;
    context.stroke();
    // A dark band of timber at the foot of each wall.
    context.fillStyle = colours.timber;
    context.fillRect(
      centre.x - tier.wall.half,
      centre.y + tier.wall.bottom - 4,
      tier.wall.half * 2,
      4,
    );
    context.beginPath();
    traceRoof(context, centre, tier);
    context.fillStyle = colours.sumi;
    context.fill();
    if (colours.rim) {
      context.strokeStyle = colours.rim;
      context.lineWidth = line * 0.9;
      context.stroke();
      context.strokeStyle = colours.sumi;
    }
    if (index === 1) {
      context.beginPath();
      traceGable(context, centre);
      context.fillStyle = colours.plaster;
      context.fill();
      context.lineWidth = line * 0.9;
      context.stroke();
    }
  });
  context.beginPath();
  traceWindows(context, centre);
  context.fillStyle = colours.windows;
  context.fill();
  if (colours.rim) {
    // By night the gate stands open and dark between its lanterns.
    context.beginPath();
    traceGate(context, centre);
    context.fillStyle = colours.sumi;
    context.fill();
  }

  context.fillStyle = colours.finials;
  for (const point of finials(centre)) {
    context.beginPath();
    context.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
    context.fill();
  }
}

/** The same keep as SVG markup, for the still map. */
export function castleSvg(
  centre: Point,
  scale = 1,
  colours: CastleColours = dayCastle,
): string {
  const pen = new SvgPen();
  const origin = { x: 0, y: 0 };
  const parts: string[] = [];
  const rim = colours.rim
    ? ` stroke="${colours.rim}" stroke-width="1.4" stroke-linejoin="round"`
    : "";
  traceBase(pen, origin);
  parts.push(
    `<path d="${pen.take()}" fill="${colours.stone}" stroke="${colours.sumi}" stroke-width="2.4"/>`,
  );
  tiers.forEach((tier, index) => {
    traceWall(pen, origin, tier);
    parts.push(
      `<path d="${pen.take()}" fill="${colours.plaster}" stroke="${colours.sumi}" stroke-width="1.6"/>`,
    );
    traceRoof(pen, origin, tier);
    parts.push(`<path d="${pen.take()}" fill="${colours.sumi}"${rim}/>`);
    if (index === 1) {
      traceGable(pen, origin);
      parts.push(
        `<path d="${pen.take()}" fill="${colours.plaster}" stroke="${colours.sumi}" stroke-width="1.4"/>`,
      );
    }
  });
  traceWindows(pen, origin);
  parts.push(`<path d="${pen.take()}" fill="${colours.windows}"/>`);
  if (colours.rim) {
    traceGate(pen, origin);
    parts.push(`<path d="${pen.take()}" fill="${colours.sumi}"/>`);
    for (const side of [-1, 1])
      parts.push(
        `<circle cx="${side * gate.lanterns}" cy="${gate.lanternY}" r="11" fill="${night.lantern}" fill-opacity="0.22"/>`,
        `<ellipse cx="${side * gate.lanterns}" cy="${gate.lanternY}" rx="3.4" ry="4.4" fill="${night.lantern}"/>`,
      );
  }
  for (const point of finials(origin))
    parts.push(
      `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.6" fill="${colours.finials}"/>`,
    );
  return `<g transform="translate(${centre.x} ${centre.y}) scale(${scale})">${parts.join("")}</g>`;
}
