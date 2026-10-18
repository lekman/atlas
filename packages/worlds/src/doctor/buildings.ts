/**
 * The buildings of the district: each hospital's grounds, main block and
 * helipad, its wings out to its departments, its ambulance bay, car park and
 * admissions annex; and The Practice, a modest clinic with a car park and a
 * garden. Where things go is worked out once per layout and kept; how they
 * are drawn is below.
 *
 * Nothing here draws a cross of any kind. The helipad carries a plain "H",
 * the bay has chevrons, and the signs carry names only.
 */
import type { Dataset } from "@atlas/core";

import type { Point } from "../camera";
import type { Layout } from "../layout";
import { pixels, withAlpha } from "../paint";
import { hashString, seededRandom } from "../random";
import type { PaintContext } from "../types";
import { doctorPalette as palette, doctorShades as shade } from "./palette";
import {
  blockInset,
  driveWidth,
  hospitalReach,
  outwardOf,
  streetPlan,
  type Rectangle,
  type Spoke,
  type Tree,
} from "./streets";

/** Half the main block of a hospital, and of The Practice. */
export const mainBlock = { width: 96, height: 72 } as const;
export const practiceBlock = { width: 80, height: 54 } as const;
export const helipadRadius = 30;
/** Half a department annex, along and across its wing. */
export const department = { along: 80, across: 78, corner: 24 } as const;
export const homeDepartment = { along: 72, across: 72, corner: 20 } as const;

export interface HospitalPlan {
  id: string;
  home: boolean;
  centre: Point;
  outward: number;
  /** The ground inside the streets around it. */
  grounds: Rectangle;
  spoke: Spoke;
  carPark: Rectangle | null;
  /** The annex where admissions without a department wait. */
  admissions: Rectangle | null;
  /** Where each department is: the far end of a wing. */
  departments: Point[];
  trees: Tree[];
}

const plans = new WeakMap<Layout, Map<string, HospitalPlan>>();

export function homeIdOf(dataset: Dataset): string | null {
  return dataset.clients.find((client) => client.home === true)?.id ?? null;
}

export function hospitalPlan(
  layout: Layout,
  dataset: Dataset,
  clientId: string,
): HospitalPlan | null {
  let byId = plans.get(layout);
  if (!byId) {
    byId = new Map();
    plans.set(layout, byId);
  }
  const known = byId.get(clientId);
  if (known) return known;
  const centre = layout.clients.get(clientId);
  if (!centre) return null;
  const homeId = homeIdOf(dataset);
  const streets = streetPlan(layout, homeId);
  const cell = streets.cells.get(clientId);
  const spoke = streets.spokes.get(clientId);
  if (!cell || !spoke) return null;
  const home = clientId === homeId;
  const grounds = {
    left: cell.left + blockInset,
    right: cell.right - blockInset,
    top: cell.top + blockInset,
    bottom: cell.bottom - blockInset,
  };
  const departments = dataset.requirements
    .filter((requirement) => requirement.clientId === clientId)
    .map((requirement) => layout.fixed.get(requirement.id))
    .filter((point): point is Point => point !== undefined);
  const loose = dataset.items
    .filter((item) => item.clientId === clientId && !item.requirementId)
    .map((item) => layout.fixed.get(item.id))
    .filter((point): point is Point => point !== undefined);
  const admissions =
    loose.length === 0
      ? null
      : {
          left: Math.min(...loose.map((point) => point.x)) - 34,
          right: Math.max(...loose.map((point) => point.x)) + 34,
          top: Math.min(...loose.map((point) => point.y)) - 30,
          bottom: Math.max(...loose.map((point) => point.y)) + 30,
        };
  const carPark = home
    ? practiceCarPark(spoke)
    : hospitalCarPark(spoke, centre);
  const plan: HospitalPlan = {
    id: clientId,
    home,
    centre,
    outward: outwardOf(centre, home),
    grounds,
    spoke,
    carPark,
    admissions,
    departments,
    trees: groundsTrees(
      clientId,
      centre,
      grounds,
      home,
      [...(carPark ? [carPark] : []), ...(admissions ? [admissions] : [])],
      spoke,
    ),
  };
  byId.set(clientId, plan);
  return plan;
}

/** The Practice's car park, around its bay and off its drive. */
function practiceCarPark(spoke: Spoke): Rectangle {
  const { bay } = spoke;
  return {
    left: bay.x - 64,
    right: bay.x + 78,
    top: bay.y - 50,
    bottom: bay.y + 50,
  };
}

/** A hospital's car park sits beside its drive, on the side away from the building. */
function hospitalCarPark(spoke: Spoke, centre: Point): Rectangle | null {
  const [bay, end] = spoke.drive;
  const length = Math.hypot(end.x - bay.x, end.y - bay.y);
  if (length < 1) return null;
  const along = { x: (end.x - bay.x) / length, y: (end.y - bay.y) / length };
  let across = { x: -along.y, y: along.x };
  if (across.x * (centre.x - bay.x) + across.y * (centre.y - bay.y) > 0)
    across = { x: -across.x, y: -across.y };
  const from = 50;
  const to = Math.min(length - 34, from + 150);
  if (to - from < 60) return null;
  const near = driveWidth / 2 + 10;
  const far = near + 82;
  const corners = [
    { t: from, s: near },
    { t: to, s: far },
  ].map(({ t, s }) => ({
    x: bay.x + along.x * t + across.x * s,
    y: bay.y + along.y * t + across.y * s,
  }));
  const [a, b] = corners;
  if (!a || !b) return null;
  return {
    left: Math.min(a.x, b.x),
    right: Math.max(a.x, b.x),
    top: Math.min(a.y, b.y),
    bottom: Math.max(a.y, b.y),
  };
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

/** Trees in the corners of the grounds, clear of the work and the drive. */
function groundsTrees(
  id: string,
  centre: Point,
  grounds: Rectangle,
  home: boolean,
  keepClear: Rectangle[],
  spoke: Spoke,
): Tree[] {
  const random = seededRandom(hashString(`${id}-trees`));
  const clear = home ? 300 : hospitalReach + 6;
  const trees: Tree[] = [];
  const spacing = 30;
  for (let y = grounds.top + 16; y < grounds.bottom - 12; y += spacing) {
    for (let x = grounds.left + 16; x < grounds.right - 12; x += spacing) {
      const point = {
        x: x + (random() - 0.5) * 12,
        y: y + (random() - 0.5) * 12,
      };
      if (Math.hypot(point.x - centre.x, point.y - centre.y) < clear) continue;
      if (distanceToSegment(point, spoke.drive[0], spoke.drive[1]) < 34)
        continue;
      if (
        keepClear.some(
          (area) =>
            point.x > area.left - 18 &&
            point.x < area.right + 18 &&
            point.y > area.top - 18 &&
            point.y < area.bottom + 18,
        )
      )
        continue;
      if (random() > 0.62) continue;
      trees.push({ ...point, radius: 8 + random() * 6 });
    }
  }
  return trees;
}

export function roundedRectangle(
  context: CanvasRenderingContext2D,
  box: Rectangle,
  radius: number,
): void {
  const r = Math.max(
    0,
    Math.min(radius, (box.right - box.left) / 2, (box.bottom - box.top) / 2),
  );
  context.beginPath();
  context.moveTo(box.left + r, box.top);
  context.arcTo(box.right, box.top, box.right, box.bottom, r);
  context.arcTo(box.right, box.bottom, box.left, box.bottom, r);
  context.arcTo(box.left, box.bottom, box.left, box.top, r);
  context.arcTo(box.left, box.top, box.right, box.top, r);
  context.closePath();
}

const accent = (alpha: number) => `rgba(${shade.accent},${alpha})`;
const warm = (alpha: number) => `rgba(${shade.warm},${alpha})`;

export function drawTrees(paint: PaintContext, trees: Tree[]): void {
  const { context } = paint;
  context.fillStyle = shade.tree;
  context.beginPath();
  for (const tree of trees) {
    context.moveTo(tree.x + tree.radius, tree.y);
    context.arc(tree.x, tree.y, tree.radius, 0, Math.PI * 2);
  }
  context.fill();
  context.fillStyle = "rgba(160,200,190,0.05)";
  context.beginPath();
  for (const tree of trees) {
    const r = tree.radius * 0.45;
    context.moveTo(
      tree.x - tree.radius * 0.25 + r,
      tree.y - tree.radius * 0.25,
    );
    context.arc(
      tree.x - tree.radius * 0.25,
      tree.y - tree.radius * 0.25,
      r,
      0,
      Math.PI * 2,
    );
  }
  context.fill();
}

/** The grounds of a hospital or The Practice: lawn, trees, drive, car park. */
export function drawGrounds(paint: PaintContext, plan: HospitalPlan): void {
  const { context } = paint;
  const { grounds } = plan;
  roundedRectangle(context, grounds, 10);
  context.fillStyle = shade.grounds;
  context.fill();
  context.strokeStyle = accent(plan.home ? 0.32 : 0.22);
  context.lineWidth = pixels(paint, 1);
  context.stroke();
  drawTrees(paint, plan.trees);

  // The drive, joining the street.
  const [bay, end] = plan.spoke.drive;
  context.strokeStyle = shade.street;
  context.lineWidth = driveWidth;
  context.lineCap = "butt";
  context.beginPath();
  context.moveTo(bay.x, bay.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.strokeStyle = warm(0.14);
  context.lineWidth = pixels(paint, 1);
  context.setLineDash([pixels(paint, 5), pixels(paint, 6)]);
  context.beginPath();
  context.moveTo(bay.x, bay.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.setLineDash([]);

  if (plan.carPark) drawCarPark(paint, plan.carPark, plan.id);
}

function drawCarPark(paint: PaintContext, area: Rectangle, id: string): void {
  const { context } = paint;
  roundedRectangle(context, area, 6);
  context.fillStyle = shade.street;
  context.fill();
  context.strokeStyle = warm(0.12);
  context.lineWidth = pixels(paint, 1);
  context.stroke();
  const wide = area.right - area.left >= area.bottom - area.top;
  const length = wide ? area.right - area.left : area.bottom - area.top;
  const depth = wide ? area.bottom - area.top : area.right - area.left;
  const spaces = Math.floor(length / 22);
  const random = seededRandom(hashString(`${id}-cars`));
  context.strokeStyle = warm(0.16);
  context.beginPath();
  for (let space = 1; space < spaces; space++) {
    const along = (length * space) / spaces;
    for (const side of [0, 1]) {
      const from = side === 0 ? 4 : depth - 4;
      const to = side === 0 ? depth * 0.36 : depth * 0.64;
      if (wide) {
        context.moveTo(area.left + along, area.top + from);
        context.lineTo(area.left + along, area.top + to);
      } else {
        context.moveTo(area.left + from, area.top + along);
        context.lineTo(area.left + to, area.top + along);
      }
    }
  }
  context.stroke();
  // A few parked cars, in quiet greys.
  for (let space = 0; space < spaces; space++) {
    for (const side of [0, 1]) {
      if (random() > 0.45) continue;
      const along = (length * (space + 0.5)) / spaces;
      const middle = side === 0 ? depth * 0.2 : depth * 0.8;
      const car = wide
        ? {
            left: area.left + along - 6,
            right: area.left + along + 6,
            top: area.top + middle - 10,
            bottom: area.top + middle + 10,
          }
        : {
            left: area.left + middle - 10,
            right: area.left + middle + 10,
            top: area.top + along - 6,
            bottom: area.top + along + 6,
          };
      roundedRectangle(context, car, 3);
      context.fillStyle = ["#3a4256", "#4a5064", "#2f394e"][
        Math.floor(random() * 3)
      ] as string;
      context.fill();
    }
  }
}

/** A thick covered link between two points: a wing or a walkway. */
export function drawLink(
  paint: PaintContext,
  from: Point,
  to: Point,
  width: number,
): void {
  const { context } = paint;
  context.lineCap = "butt";
  context.strokeStyle = accent(0.5);
  context.lineWidth = width + pixels(paint, 2.4);
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.strokeStyle = shade.roof;
  context.lineWidth = width;
  context.stroke();
}

/** A rectangle turned to an angle about its centre, as a path. */
export function turnedRectangle(
  context: CanvasRenderingContext2D,
  centre: Point,
  angle: number,
  halfAlong: number,
  halfAcross: number,
  corner: number,
): void {
  context.save();
  context.translate(centre.x, centre.y);
  context.rotate(angle);
  roundedRectangle(
    context,
    {
      left: -halfAlong,
      right: halfAlong,
      top: -halfAcross,
      bottom: halfAcross,
    },
    corner,
  );
  context.restore();
}

/** The main block: a flat roof with a parapet and the helipad. */
export function drawMainBlock(
  paint: PaintContext,
  centre: Point,
  half: { width: number; height: number },
): void {
  const { context } = paint;
  const box = {
    left: centre.x - half.width,
    right: centre.x + half.width,
    top: centre.y - half.height,
    bottom: centre.y + half.height,
  };
  roundedRectangle(context, box, 12);
  context.fillStyle = shade.roof;
  context.fill();
  context.strokeStyle = accent(0.72);
  context.lineWidth = pixels(paint, 1.5);
  context.stroke();
  roundedRectangle(
    context,
    {
      left: box.left + 8,
      right: box.right - 8,
      top: box.top + 8,
      bottom: box.bottom - 8,
    },
    6,
  );
  context.strokeStyle = accent(0.16);
  context.lineWidth = pixels(paint, 1);
  context.stroke();
  // Roof plant in two corners.
  context.fillStyle = "#273350";
  for (const [x, y] of [
    [box.left + 14, box.top + 14],
    [box.right - 34, box.bottom - 30],
  ] as const) {
    context.fillRect(x, y, 20, 16);
  }
}

/** The helipad on the roof: a ring and a plain H, nothing else. */
export function drawHelipad(paint: PaintContext, centre: Point): void {
  const { context } = paint;
  context.fillStyle = shade.helipad;
  context.beginPath();
  context.arc(centre.x, centre.y, helipadRadius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = withAlpha(palette.ink, 0.6);
  context.lineWidth = Math.max(2.2, pixels(paint, 1.2));
  context.beginPath();
  context.arc(centre.x, centre.y, helipadRadius - 4, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = withAlpha(palette.ink, 0.78);
  const h = 13;
  const stroke = 4;
  context.fillRect(centre.x - h * 0.62, centre.y - h, stroke, h * 2);
  context.fillRect(centre.x + h * 0.62 - stroke, centre.y - h, stroke, h * 2);
  context.fillRect(
    centre.x - h * 0.62,
    centre.y - stroke / 2,
    h * 1.24,
    stroke,
  );
  // Four small edge lights in the accent.
  context.fillStyle = accent(0.8);
  for (let light = 0; light < 4; light++) {
    const angle = Math.PI / 4 + (light * Math.PI) / 2;
    context.beginPath();
    context.arc(
      centre.x + Math.cos(angle) * (helipadRadius - 1),
      centre.y + Math.sin(angle) * (helipadRadius - 1),
      Math.max(1.6, pixels(paint, 1)),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

/** The ambulance bay: a canopy across the end of the drive, with chevrons. */
export function drawBay(paint: PaintContext, spoke: Spoke): void {
  const { context } = paint;
  const [bay, end] = spoke.drive;
  const angle = Math.atan2(end.y - bay.y, end.x - bay.x);
  context.save();
  context.translate(bay.x, bay.y);
  context.rotate(angle);
  roundedRectangle(context, { left: -30, right: 30, top: -30, bottom: 30 }, 6);
  context.fillStyle = shade.street;
  context.fill();
  context.save();
  context.clip();
  context.strokeStyle = accent(0.4);
  context.lineWidth = 4;
  context.beginPath();
  for (let stripe = -3; stripe <= 3; stripe++) {
    const x = stripe * 13;
    context.moveTo(x - 10, -30);
    context.lineTo(x + 2, 0);
    context.lineTo(x - 10, 30);
  }
  context.stroke();
  context.restore();
  // The canopy over the back of the bay, and the doors into the building.
  context.fillStyle = shade.roof;
  context.fillRect(-38, -36, 18, 72);
  context.strokeStyle = accent(0.65);
  context.lineWidth = pixels(paint, 1.2);
  context.strokeRect(-38, -36, 18, 72);
  context.restore();
}

/** A department: an annex at the end of its wing, its floor and its desk. */
export function drawDepartment(
  paint: PaintContext,
  centre: Point,
  angle: number,
  size: { along: number; across: number; corner: number },
  done: boolean,
): void {
  const { context } = paint;
  turnedRectangle(
    context,
    centre,
    angle,
    size.along + 6,
    size.across + 6,
    size.corner + 4,
  );
  context.fillStyle = shade.roof;
  context.fill();
  context.strokeStyle = accent(done ? 0.35 : 0.7);
  context.lineWidth = pixels(paint, 1.5);
  context.stroke();
  turnedRectangle(context, centre, angle, size.along, size.across, size.corner);
  context.fillStyle = shade.floor;
  context.globalAlpha = done ? 0.6 : 1;
  context.fill();
  context.globalAlpha = 1;
}

/**
 * The sign at the front of a place: one plate, in screen pixels, with the
 * name and, when there is room, a short detail after it. The plate never
 * grows wider than `maxWidth`: the detail goes first, then the letters
 * shrink, so a sign stays inside its own grounds on a phone.
 */
export function drawSign(
  paint: PaintContext,
  options: {
    x: number;
    y: number;
    name: string;
    detail?: string;
    align: "left" | "right" | "center";
    maxWidth: number;
    plate: string;
    edge: string;
    nameColour: string;
    detailColour: string;
    nameSize: number;
    font: string;
    detailFont: string;
  },
): { width: number; height: number } {
  const { context } = paint;
  context.save();
  let nameSize = options.nameSize;
  const measure = (size: number, withDetail: boolean) => {
    context.font = `500 ${size}px ${options.font}`;
    const name = context.measureText(options.name).width;
    let detail = 0;
    if (withDetail && options.detail) {
      context.font = `400 ${Math.max(9, size * 0.68)}px ${options.detailFont}`;
      detail = context.measureText(options.detail).width + size * 0.7;
    }
    return { name, detail, total: name + detail + size * 1.2 };
  };
  let showDetail = Boolean(options.detail);
  let size = measure(nameSize, showDetail);
  if (size.total > options.maxWidth) {
    showDetail = false;
    size = measure(nameSize, false);
  }
  while (size.total > options.maxWidth && nameSize > 9) {
    nameSize -= 0.5;
    size = measure(nameSize, false);
  }
  const width = size.total;
  const height = nameSize * 1.75;
  const left =
    options.align === "left"
      ? options.x
      : options.align === "right"
        ? options.x - width
        : options.x - width / 2;
  const top = options.y;
  roundedRectangle(
    context,
    { left, top, right: left + width, bottom: top + height },
    Math.min(5, height / 4),
  );
  context.fillStyle = options.plate;
  context.fill();
  context.strokeStyle = options.edge;
  context.lineWidth = 1;
  context.stroke();
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = options.nameColour;
  context.font = `500 ${nameSize}px ${options.font}`;
  const middle = top + height / 2 + 0.5;
  context.fillText(options.name, left + nameSize * 0.6, middle);
  if (showDetail && options.detail) {
    context.fillStyle = options.detailColour;
    context.font = `400 ${Math.max(9, nameSize * 0.68)}px ${options.detailFont}`;
    context.fillText(
      options.detail,
      left + nameSize * 0.6 + size.name + nameSize * 0.7,
      middle,
    );
  }
  context.restore();
  return { width, height };
}
