/**
 * The Doctor's district: a town plan at night seen from above. Clients are
 * hospitals on their own blocks, each with wings out to its departments, a
 * helipad on the roof, an ambulance bay and a car park. Home is The
 * Practice, a small clinic inside a ring road at the centre. Main roads run
 * from the ring to every hospital, and a grid of quiet streets fills the
 * rest. Messages between agents are ambulance runs along the streets; events
 * from outside arrive by air ambulance.
 *
 * It is a metaphor for work. Nothing here imitates a real hospital, vehicle
 * or device, shows anything like patient data, or uses a protected emblem:
 * there is no cross shape anywhere.
 */
import { externalSourceNames, isVessel } from "@atlas/core";

import { worldToScreen, type Point } from "../camera";
import { decisionPosition, itemPosition, questionPosition } from "../layout";
import {
  agentLabelSize,
  bodyScale,
  clientIdOfAgent,
  label,
  labelScale,
  pixels,
  pulsePhase,
  setScreenTransform,
  setWorldTransform,
  showsAgentName,
  showsAgentStatus,
  withAlpha,
  workstreamCaption,
  workstreamCaptionRise,
} from "../paint";
import type { PaintContext, WorldPainter } from "../types";
import {
  department,
  drawBay,
  drawDepartment,
  drawGrounds,
  drawHelipad,
  drawLink,
  drawMainBlock,
  drawSign,
  drawTrees,
  homeDepartment,
  homeIdOf,
  hospitalPlan,
  mainBlock,
  practiceBlock,
  roundedRectangle,
  turnedRectangle,
  type HospitalPlan,
} from "./buildings";
import { doctorTypefaces as type, toneOf } from "./palette";
import {
  blockInset,
  mainRoadWidth,
  measure,
  ringHalf,
  poseAlong,
  routeBetween,
  streetPlan,
  streetWidth,
  type Rectangle,
  type StreetPlan,
} from "./streets";
import { drawAmbulance, drawHelicopter, drawTrolley } from "./vehicles";
import { doctorStatusNames, doctorVocabulary } from "./vocabulary";

const isFull = (paint: PaintContext) => paint.detail === "full";

function plansOf(paint: PaintContext): StreetPlan {
  return streetPlan(paint.scene.layout, homeIdOf(paint.scene.dataset));
}

function planOf(paint: PaintContext, clientId: string): HospitalPlan | null {
  return hospitalPlan(paint.scene.layout, paint.scene.dataset, clientId);
}

/** The part of the world on screen, with a margin. */
function view(paint: PaintContext, margin = 80): Rectangle {
  const { camera, width, height } = paint;
  return {
    left: -camera.x / camera.scale - margin,
    top: -camera.y / camera.scale - margin,
    right: (width - camera.x) / camera.scale + margin,
    bottom: (height - camera.y) / camera.scale + margin,
  };
}

const overlaps = (a: Rectangle, b: Rectangle) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function drawTown(paint: PaintContext, plan: StreetPlan, seen: Rectangle) {
  const { shade, warm } = toneOf(paint.lighting);
  const { context, camera } = paint;
  const visible = plan.town.filter((block) => overlaps(block.area, seen));

  context.fillStyle = shade.park;
  context.beginPath();
  for (const block of visible) {
    if (block.kind === "buildings") continue;
    const { area } = block;
    context.rect(
      area.left,
      area.top,
      area.right - area.left,
      area.bottom - area.top,
    );
  }
  context.fill();

  context.fillStyle = shade.building;
  context.strokeStyle = shade.buildingEdge;
  context.lineWidth = pixels(paint, 1);
  context.beginPath();
  for (const block of visible)
    for (const building of block.buildings)
      context.rect(
        building.left,
        building.top,
        building.right - building.left,
        building.bottom - building.top,
      );
  context.fill();
  context.stroke();

  // A scatter of lit windows, dim and warm.
  if (shade.lit && camera.scale > 0.14) {
    context.fillStyle = warm(0.32);
    context.beginPath();
    for (const block of visible)
      for (const window of block.windows)
        context.rect(window.x - 2.5, window.y - 2, 5, 4);
    context.fill();
  }

  for (const block of visible) {
    if (block.path.length < 2) continue;
    context.strokeStyle = warm(0.07);
    context.lineWidth = 5;
    context.beginPath();
    block.path.forEach((point, index) =>
      index === 0
        ? context.moveTo(point.x, point.y)
        : context.lineTo(point.x, point.y),
    );
    context.stroke();
  }
  drawTrees(
    paint,
    visible.flatMap((block) => block.trees),
  );
}

function drawRiver(paint: PaintContext, plan: StreetPlan) {
  const { shade } = toneOf(paint.lighting);
  const { river } = plan;
  if (!river) return;
  const { context } = paint;
  const [left, right] = river.banks;
  context.fillStyle = shade.river;
  context.beginPath();
  left.forEach((point, index) =>
    index === 0
      ? context.moveTo(point.x, point.y)
      : context.lineTo(point.x, point.y),
  );
  for (let index = right.length - 1; index >= 0; index--) {
    const point = right[index];
    if (point) context.lineTo(point.x, point.y);
  }
  context.closePath();
  context.fill();
  context.strokeStyle = shade.riverEdge;
  context.lineWidth = pixels(paint, 1.4);
  for (const bank of river.banks) {
    context.beginPath();
    bank.forEach((point, index) =>
      index === 0
        ? context.moveTo(point.x, point.y)
        : context.lineTo(point.x, point.y),
    );
    context.stroke();
  }
}

function drawStreets(paint: PaintContext, plan: StreetPlan, seen: Rectangle) {
  const { shade, warm } = toneOf(paint.lighting);
  const { context } = paint;
  const near = (a: Point, b: Point) =>
    overlaps(
      {
        left: Math.min(a.x, b.x),
        right: Math.max(a.x, b.x),
        top: Math.min(a.y, b.y),
        bottom: Math.max(a.y, b.y),
      },
      seen,
    );
  context.lineCap = "square";
  context.lineJoin = "miter";
  const streetPath = () => {
    context.beginPath();
    for (const edge of plan.edges) {
      if (edge.drive) continue;
      const a = plan.nodes[edge.a];
      const b = plan.nodes[edge.b];
      if (!a || !b || !near(a, b)) continue;
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
    }
  };
  if (shade.streetEdge !== shade.street) {
    context.strokeStyle = shade.streetEdge;
    context.lineWidth = streetWidth + pixels(paint, 2);
    streetPath();
    context.stroke();
  }
  context.strokeStyle = shade.street;
  context.lineWidth = streetWidth;
  context.beginPath();
  for (const edge of plan.edges) {
    if (edge.drive) continue;
    const a = plan.nodes[edge.a];
    const b = plan.nodes[edge.b];
    if (!a || !b || !near(a, b)) continue;
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
  }
  context.stroke();

  // Bridges: railings where a street crosses the river.
  const { river } = plan;
  if (river) {
    context.strokeStyle = warm(0.22);
    context.lineWidth = pixels(paint, 1.2);
    context.lineCap = "butt";
    context.beginPath();
    for (const edge of plan.edges) {
      const a = plan.nodes[edge.a];
      const b = plan.nodes[edge.b];
      if (!a || !b || edge.drive) continue;
      const across = river.vertical
        ? Math.abs(a.y - b.y) < 0.5 &&
          Math.min(a.x, b.x) <= river.band.left + 1 &&
          Math.max(a.x, b.x) >= river.band.right - 1
        : Math.abs(a.x - b.x) < 0.5 &&
          Math.min(a.y, b.y) <= river.band.top + 1 &&
          Math.max(a.y, b.y) >= river.band.bottom - 1;
      if (!across) continue;
      for (const side of [-1, 1]) {
        const offset = side * (streetWidth / 2 + 2);
        if (river.vertical) {
          context.moveTo(river.band.left + blockInset, a.y + offset);
          context.lineTo(river.band.right - blockInset, a.y + offset);
        } else {
          context.moveTo(a.x + offset, river.band.top + blockInset);
          context.lineTo(a.x + offset, river.band.bottom - blockInset);
        }
      }
    }
    context.stroke();
  }

  // Main roads: wider, a little lighter, with a faint centre line.
  context.lineCap = "square";
  if (shade.mainRoadEdge !== shade.mainRoad) {
    context.strokeStyle = shade.mainRoadEdge;
    context.lineWidth = mainRoadWidth + pixels(paint, 2.5);
    context.beginPath();
    for (const road of plan.mainRoads)
      road.forEach((point, index) =>
        index === 0
          ? context.moveTo(point.x, point.y)
          : context.lineTo(point.x, point.y),
      );
    context.stroke();
  }
  context.strokeStyle = shade.mainRoad;
  context.lineWidth = mainRoadWidth;
  context.beginPath();
  for (const road of plan.mainRoads)
    road.forEach((point, index) =>
      index === 0
        ? context.moveTo(point.x, point.y)
        : context.lineTo(point.x, point.y),
    );
  context.stroke();
  context.lineCap = "butt";
  context.strokeStyle = warm(0.2);
  context.lineWidth = Math.max(1.5, pixels(paint, 1));
  context.setLineDash([14, 12]);
  context.beginPath();
  for (const road of plan.mainRoads)
    road.forEach((point, index) =>
      index === 0
        ? context.moveTo(point.x, point.y)
        : context.lineTo(point.x, point.y),
    );
  context.stroke();
  context.setLineDash([]);

  // Street lights along the main roads, glowing faintly after dark.
  if (!shade.lit) return;
  const lights = plan.lights.filter(
    (light) =>
      light.x > seen.left &&
      light.x < seen.right &&
      light.y > seen.top &&
      light.y < seen.bottom,
  );
  context.fillStyle = warm(0.045);
  context.beginPath();
  for (const light of lights) {
    context.moveTo(light.x + 26, light.y);
    context.arc(light.x, light.y, 26, 0, Math.PI * 2);
  }
  context.fill();
  context.fillStyle = warm(0.06);
  context.beginPath();
  for (const light of lights) {
    context.moveTo(light.x + 12, light.y);
    context.arc(light.x, light.y, 12, 0, Math.PI * 2);
  }
  context.fill();
  context.fillStyle = warm(0.75);
  context.beginPath();
  const dot = Math.max(2, pixels(paint, 1.1));
  for (const light of lights) {
    context.moveTo(light.x + dot, light.y);
    context.arc(light.x, light.y, dot, 0, Math.PI * 2);
  }
  context.fill();
}

function tick(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  context.beginPath();
  context.moveTo(x - size * 0.55, y);
  context.lineTo(x - size * 0.15, y + size * 0.4);
  context.lineTo(x + size * 0.6, y - size * 0.45);
  context.stroke();
}

/** A ward's floor: where its admissions wait, beside the ward's sign. */
function drawWard(paint: PaintContext, area: Rectangle) {
  const { shade, accent } = toneOf(paint.lighting);
  const { context } = paint;
  roundedRectangle(
    context,
    {
      left: area.left - 6,
      right: area.right + 6,
      top: area.top - 6,
      bottom: area.bottom + 6,
    },
    18,
  );
  context.fillStyle = shade.roof;
  context.fill();
  context.strokeStyle = accent(0.6);
  context.lineWidth = pixels(paint, 1.4);
  context.stroke();
  roundedRectangle(context, area, 14);
  context.fillStyle = shade.floor;
  context.fill();
}

/** The Practice: a small clinic with a hipped roof, a lit window and a door light. */
function drawPractice(paint: PaintContext, plan: HospitalPlan) {
  const { shade, accent, warm } = toneOf(paint.lighting);
  const { context, reducedMotion, time } = paint;
  const { x, y } = plan.centre;
  const half = practiceBlock;
  const box = {
    left: x - half.width,
    right: x + half.width,
    top: y - half.height,
    bottom: y + half.height,
  };
  // The door faces the car park.
  const door = { x: box.right, y: y + 14 };
  // At night the door lamp glows warm; by day a small violet lamp marks
  // the door instead. Each breathes slowly, and holds still on request.
  const breath = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * 0.8);
  const pool = context.createRadialGradient(
    door.x,
    door.y,
    0,
    door.x,
    door.y,
    46,
  );
  const glow = shade.lit ? warm : accent;
  pool.addColorStop(
    0,
    glow(shade.lit ? 0.24 + 0.08 * breath : 0.12 + 0.12 * breath),
  );
  pool.addColorStop(1, glow(0));
  context.fillStyle = pool;
  context.beginPath();
  context.arc(door.x, door.y, 46, 0, Math.PI * 2);
  context.fill();

  roundedRectangle(context, box, 8);
  context.fillStyle = shade.roof;
  context.fill();
  context.strokeStyle = accent(0.85);
  context.lineWidth = pixels(paint, 1.6);
  context.stroke();
  // A hipped roof: a ridge and four hips.
  context.strokeStyle = accent(0.3);
  context.lineWidth = pixels(paint, 1);
  const ridge = half.width - half.height;
  context.beginPath();
  context.moveTo(x - ridge, y);
  context.lineTo(x + ridge, y);
  context.moveTo(box.left + 3, box.top + 3);
  context.lineTo(x - ridge, y);
  context.lineTo(box.left + 3, box.bottom - 3);
  context.moveTo(box.right - 3, box.top + 3);
  context.lineTo(x + ridge, y);
  context.lineTo(box.right - 3, box.bottom - 3);
  context.stroke();

  // Windows along the front. After dark two are lit, one of them softly
  // brightening and dimming; by day they are glass.
  const windows = [-0.62, -0.22, 0.22, 0.62];
  windows.forEach((at, index) => {
    const lit = index === 1 ? 0.55 + 0.35 * breath : index === 3 ? 0.6 : 0.16;
    context.fillStyle = shade.lit ? warm(lit) : shade.glass;
    context.fillRect(x + at * half.width - 7, box.bottom - 3, 14, 5);
  });
  context.fillStyle = shade.lit ? warm(0.9) : accent(0.55 + 0.4 * breath);
  context.fillRect(door.x - 2, door.y - 9, 5, 18);
}

function drawBed(
  paint: PaintContext,
  position: Point,
  angle: number,
  state: string,
  high: boolean,
) {
  const { shade } = toneOf(paint.lighting);
  const { context } = paint;
  const length = Math.max(22, pixels(paint, 11));
  const width = length * 0.6;
  const half = { x: length / 2, y: width / 2 };
  const line = pixels(paint, 1.2);
  context.save();
  context.translate(position.x, position.y);
  context.rotate(angle);
  if (state === "done") context.globalAlpha *= 0.45;
  const frame = { left: -half.x, right: half.x, top: -half.y, bottom: half.y };
  roundedRectangle(context, frame, width * 0.18);
  context.fillStyle = shade.bedBase;
  context.fill();
  context.strokeStyle = shade.bedFrame;
  context.lineWidth = line;
  context.stroke();
  // The pillow at the head, towards the department's desk.
  const pillow = {
    left: -half.x + length * 0.07,
    right: -half.x + length * 0.27,
    top: -half.y + width * 0.16,
    bottom: half.y - width * 0.16,
  };
  roundedRectangle(context, pillow, width * 0.12);
  if (state === "todo") {
    context.strokeStyle = withAlpha(shade.bedFrame, 0.75);
    context.stroke();
  } else {
    context.fillStyle = shade.bedCover;
    context.fill();
  }
  const blanket = {
    left: -half.x + length * 0.33,
    right: half.x - line,
    top: -half.y + line,
    bottom: half.y - line,
  };
  context.fillStyle = shade.bedCover;
  switch (state) {
    case "doing":
      // In use: the blanket up over the bed.
      context.fillRect(
        blanket.left,
        blanket.top,
        blanket.right - blanket.left,
        blanket.bottom - blanket.top,
      );
      context.fillStyle = shade.bedBase;
      context.fillRect(
        blanket.left + length * 0.08,
        blanket.top,
        line,
        blanket.bottom - blanket.top,
      );
      break;
    case "review":
      // Half made: the blanket turned back corner to corner.
      context.beginPath();
      context.moveTo(blanket.left, blanket.bottom);
      context.lineTo(blanket.right, blanket.top);
      context.lineTo(blanket.right, blanket.bottom);
      context.closePath();
      context.fill();
      break;
    case "done":
      // Made: the blanket square, with its top folded over.
      context.fillRect(
        blanket.left,
        blanket.top,
        blanket.right - blanket.left,
        blanket.bottom - blanket.top,
      );
      context.strokeStyle = shade.bedBase;
      context.lineWidth = line;
      context.beginPath();
      context.moveTo(blanket.left + length * 0.1, blanket.top);
      context.lineTo(blanket.left + length * 0.1, blanket.bottom);
      context.stroke();
      break;
    default:
      // Empty: nothing on it but the pillow's outline.
      break;
  }
  if (high) {
    // A second frame: higher priority.
    context.globalAlpha *= 0.85;
    roundedRectangle(
      context,
      {
        left: frame.left - length * 0.16,
        right: frame.right + length * 0.16,
        top: frame.top - length * 0.16,
        bottom: frame.bottom + length * 0.16,
      },
      width * 0.3,
    );
    context.strokeStyle = shade.bedFrame;
    context.lineWidth = line;
    context.stroke();
  }
  context.restore();
}

/** Dotted line between two points, for handovers and air ambulance drops. */
function dotted(
  paint: PaintContext,
  from: Point,
  to: Point,
  colour: string,
  alpha: number,
) {
  if (alpha <= 0) return;
  const { context } = paint;
  context.save();
  context.strokeStyle = withAlpha(colour, alpha);
  context.lineWidth = pixels(paint, 1.3);
  context.setLineDash([pixels(paint, 2), pixels(paint, 4)]);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.restore();
}

function polyline(context: CanvasRenderingContext2D, points: Point[]) {
  context.beginPath();
  points.forEach((point, index) =>
    index === 0
      ? context.moveTo(point.x, point.y)
      : context.lineTo(point.x, point.y),
  );
}

export const doctorPainter: WorldPainter = {
  background(paint) {
    const { palette } = toneOf(paint.lighting);
    const { context, width, height } = paint;
    setScreenTransform(paint);
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, width, height);
    setWorldTransform(paint);
    const plan = plansOf(paint);
    const seen = view(paint);
    drawTown(paint, plan, seen);
    drawRiver(paint, plan);
    drawStreets(paint, plan, seen);
  },

  home(paint, home) {
    const plan = planOf(paint, home.id);
    if (!plan) return;
    drawGrounds(paint, plan);
    for (const ward of plan.wards) drawWard(paint, ward);
    for (const room of plan.departments) drawLink(paint, plan.centre, room, 28);
    drawPractice(paint, plan);
  },

  client(paint, client) {
    const plan = planOf(paint, client.id);
    if (!plan) return;
    drawGrounds(paint, plan);
    for (const ward of plan.wards) drawWard(paint, ward);
    drawLink(paint, plan.centre, plan.spoke.bay, 18);
    for (const room of plan.departments) drawLink(paint, plan.centre, room, 34);
    drawMainBlock(paint, plan.centre, mainBlock);
    drawHelipad(paint, plan.centre);
    drawBay(paint, plan.spoke);
  },

  requirement(paint, requirement) {
    const { palette, shade, accent } = toneOf(paint.lighting);
    const { context, scene } = paint;
    const point = scene.layout.fixed.get(requirement.id);
    const centre = scene.layout.clients.get(requirement.clientId);
    if (!point || !centre) return;
    const home =
      scene.dataset.clients.find((client) => client.id === requirement.clientId)
        ?.home === true;
    const angle = Math.atan2(point.y - centre.y, point.x - centre.x);
    const size = home ? homeDepartment : department;
    const done = requirement.state === "done";
    drawDepartment(paint, point, angle, size, done);

    // The department's desk, where its staff gather.
    turnedRectangle(context, point, angle, 13, 10, 4);
    context.fillStyle = shade.roof;
    context.fill();
    context.strokeStyle = accent(done ? 0.4 : 0.9);
    context.lineWidth = pixels(paint, 1.3);
    context.stroke();
    context.strokeStyle = palette.ink;
    if (done) tick(context, point.x, point.y, 9);
    else {
      context.fillStyle = palette.ink;
      context.beginPath();
      context.arc(point.x, point.y, 3, 0, Math.PI * 2);
      context.fill();
    }

    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      const reach = size.along + 14;
      const x = point.x + Math.cos(angle) * reach;
      const y = point.y + Math.sin(angle) * reach;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      label(paint, requirement.title, x, y, {
        size: 10,
        font: type.mono,
        colour: done ? palette.mute : shade.labelDepartment,
        align: cos > 0.45 ? "left" : cos < -0.45 ? "right" : "center",
        baseline: sin > 0.45 ? "top" : sin < -0.45 ? "bottom" : "middle",
      });
    }
  },

  workstream(paint, marker) {
    const { palette, shade, accent } = toneOf(paint.lighting);
    const { context } = paint;
    const { x, y } = marker.position;
    const unsorted = marker.workstreamId === null;
    // A ward: a small block with its sign. Unsorted work waits at an
    // outlined bay instead.
    context.save();
    context.translate(x, y);
    context.lineWidth = pixels(paint, 1.3);
    if (unsorted) {
      context.strokeStyle = accent(0.8);
      context.setLineDash([pixels(paint, 3), pixels(paint, 3)]);
      context.strokeRect(-11, -9, 22, 18);
      context.setLineDash([]);
    } else {
      context.fillStyle = shade.roof;
      context.strokeStyle = accent(0.9);
      context.fillRect(-12, -10, 24, 20);
      context.strokeRect(-12, -10, 24, 20);
      // A bed on the sign, never a cross: see buildings.ts.
      context.strokeStyle = palette.ink;
      context.lineWidth = pixels(paint, 1.6);
      context.beginPath();
      context.moveTo(-7, -4);
      context.lineTo(-7, 5);
      context.moveTo(-7, 2);
      context.lineTo(7, 2);
      context.lineTo(7, 5);
      context.stroke();
      context.fillStyle = palette.ink;
      context.fillRect(-5, -2, 4, 3);
      context.fillRect(0, -1, 7, 3);
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(paint, workstreamCaption(marker), x, y - workstreamCaptionRise, {
        size: 10,
        font: type.mono,
        colour: palette.ink,
        align: "center",
        baseline: "bottom",
        italic: unsorted,
      });
    }
  },

  link(paint, item) {
    const { accent } = toneOf(paint.lighting);
    const { context, scene } = paint;
    const from = item.requirementId
      ? scene.layout.fixed.get(item.requirementId)
      : undefined;
    if (!from) return;
    const to = itemPosition(scene.layout, item);
    context.strokeStyle = accent(0.14);
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  },

  item(paint, item) {
    const { shade } = toneOf(paint.lighting);
    const { scene } = paint;
    const point = itemPosition(scene.layout, item);
    const from = item.requirementId
      ? scene.layout.fixed.get(item.requirementId)
      : scene.layout.clients.get(item.clientId);
    const angle = from ? Math.atan2(point.y - from.y, point.x - from.x) : 0;
    drawBed(paint, point, angle, item.state, item.priority === "high");
    if (isFull(paint) && paint.camera.scale > labelScale.item) {
      label(paint, item.title, point.x + pixels(paint, 16), point.y, {
        size: 10,
        font: type.mono,
        colour: shade.labelItem,
      });
    }
  },

  question(paint, question, fade) {
    const { palette, shade } = toneOf(paint.lighting);
    const { context, scene, time, reducedMotion } = paint;
    const point = questionPosition(
      scene.layout,
      scene.dataset,
      question,
      time,
      reducedMotion,
    );
    context.save();
    context.globalAlpha = fade;
    const blocked = scene.dataset.items.find(
      (item) => item.id === question.blocks,
    );
    if (blocked) {
      const to = itemPosition(scene.layout, blocked);
      context.setLineDash([pixels(paint, 2), pixels(paint, 4)]);
      context.strokeStyle = withAlpha(shade.sample, 0.45);
      context.lineWidth = pixels(paint, 1);
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.setLineDash([]);
    }

    // A test tube waiting on its result.
    const grow = Math.max(1, pixels(paint, 7) / 14);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(-0.3);
    context.scale(grow, grow);
    const tube = () => {
      context.beginPath();
      context.moveTo(-5, -14);
      context.lineTo(-5, 8);
      context.arc(0, 8, 5, Math.PI, 0, true);
      context.lineTo(5, -14);
    };
    tube();
    context.fillStyle = shade.tube;
    context.fill();
    context.save();
    context.clip();
    context.fillStyle = withAlpha(shade.sample, 0.85);
    context.fillRect(-6, 0, 12, 14);
    context.restore();
    tube();
    context.strokeStyle = shade.sample;
    context.lineWidth = pixels(paint, 1.3) / grow;
    context.stroke();
    context.beginPath();
    context.moveTo(-7.5, -14);
    context.lineTo(7.5, -14);
    context.stroke();
    context.restore();
    if (isFull(paint))
      label(paint, "?", point.x + 11 * grow, point.y - 9 * grow, {
        size: 11,
        font: type.display,
        colour: shade.sample,
        align: "center",
      });

    if (question.asks === "You") {
      const phase = pulsePhase(paint, 1.1, question.id.length * 0.13);
      context.strokeStyle = withAlpha(palette.status.waiting, 1 - phase);
      context.lineWidth = pixels(paint, 1.6);
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        pixels(paint, 13) + phase * pixels(paint, 14),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(
        paint,
        `Result pending · ${question.title}`,
        point.x - pixels(paint, 12),
        point.y - pixels(paint, 16),
        {
          size: 10,
          font: type.mono,
          colour: shade.sample,
          align: "right",
        },
      );
    }
    context.restore();
  },

  decision(paint, decision, appear) {
    const { shade, accent } = toneOf(paint.lighting);
    const { context, scene } = paint;
    const point = decisionPosition(scene.layout, scene.dataset, decision);
    const made = decision.state === "made";
    const grow = (1 + (1 - appear) * 0.9) * Math.max(1, pixels(paint, 8) / 14);
    context.save();
    context.globalAlpha = Math.min(1, appear * 1.4);
    context.translate(point.x, point.y);
    context.scale(grow, grow);
    // A signed chart on its clipboard.
    const sheet = { left: -9, top: -11, right: 9, bottom: 12 };
    roundedRectangle(
      context,
      { left: -10.5, top: -12.5, right: 10.5, bottom: 13.5 },
      3,
    );
    context.fillStyle = shade.kerb;
    context.fill();
    roundedRectangle(context, sheet, 2);
    if (made) {
      context.fillStyle = shade.paper;
      context.fill();
    } else {
      context.setLineDash([2, 2]);
      context.strokeStyle = withAlpha(shade.paper, 0.6);
      context.lineWidth = 1;
      context.stroke();
      context.setLineDash([]);
    }
    context.fillStyle = shade.chartClip;
    context.fillRect(-4.5, -13, 9, 3.5);
    context.strokeStyle = made ? shade.chartLines : accent(0.4);
    context.lineWidth = 0.9;
    for (const line of [-5, -1.5, 2]) {
      context.beginPath();
      context.moveTo(-6, line);
      context.lineTo(line > 1 ? 2 : 6, line);
      context.stroke();
    }
    if (made) {
      // The signature, written as the decision appears.
      context.strokeStyle = shade.signature;
      context.lineWidth = 1.2;
      context.beginPath();
      const steps = Math.max(1, Math.round(20 * appear));
      for (let step = 0; step <= steps; step++) {
        const along = step / 20;
        const sx = -6 + along * 12;
        const sy = 7.5 - Math.sin(along * Math.PI * 3.2) * 2.2 + along * 0.5;
        if (step === 0) context.moveTo(sx, sy);
        else context.lineTo(sx, sy);
      }
      context.stroke();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      label(
        paint,
        `Diagnosis · ${decision.title}`,
        point.x + 15 * grow,
        point.y,
        {
          size: 9.5,
          font: type.mono,
          colour: shade.labelDecision,
          alpha: appear,
        },
      );
    }
  },

  agent(paint, agent, motion, colour) {
    const { palette } = toneOf(paint.lighting);
    const { context } = paint;
    const { position, trail } = motion;

    // Faint footsteps behind staff on rounds.
    if (agent.status === "running" && trail.length > 6) {
      for (let index = 4; index < trail.length; index += 4) {
        const here = trail[index];
        const before = trail[index - 2];
        if (!here || !before) continue;
        const heading = Math.atan2(here.y - before.y, here.x - before.x);
        if (Math.hypot(here.x - before.x, here.y - before.y) < 0.4) continue;
        const side = (index / 4) % 2 === 0 ? 1 : -1;
        const across = heading + Math.PI / 2;
        context.fillStyle = withAlpha(colour, (1 - index / trail.length) * 0.4);
        context.beginPath();
        context.ellipse(
          here.x + Math.cos(across) * pixels(paint, 3) * side,
          here.y + Math.sin(across) * pixels(paint, 3) * side,
          pixels(paint, 2.2),
          pixels(paint, 1.3),
          heading,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }

    // An identity badge on a clip: upright, in the status colour. A
    // trainee's badge is smaller.
    const scale = bodyScale(agent);
    const size =
      pixels(paint, isFull(paint) ? 6.5 : 5) *
      Math.max(1, paint.camera.scale * 1.5) *
      scale;
    const badge = {
      left: position.x - size * 0.78,
      right: position.x + size * 0.78,
      top: position.y - size * 1.05,
      bottom: position.y + size * 1.05,
    };
    const rim = pixels(paint, 1.5);
    roundedRectangle(
      context,
      {
        left: badge.left - rim,
        right: badge.right + rim,
        top: badge.top - rim,
        bottom: badge.bottom + rim,
      },
      size * 0.45,
    );
    context.fillStyle = palette.ground;
    context.fill();
    roundedRectangle(context, badge, size * 0.35);
    context.fillStyle = colour;
    context.fill();
    context.fillStyle = withAlpha(palette.ground, 0.85);
    roundedRectangle(
      context,
      {
        left: position.x - size * 0.32,
        right: position.x + size * 0.32,
        top: badge.top + size * 0.22,
        bottom: badge.top + size * 0.44,
      },
      size * 0.1,
    );
    context.fill();
    context.fillStyle = withAlpha(palette.ground, 0.45);
    context.beginPath();
    context.arc(
      position.x,
      position.y + size * 0.12,
      size * 0.3,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillRect(
      position.x - size * 0.45,
      position.y + size * 0.6,
      size * 0.9,
      size * 0.14,
    );

    if (paint.scene.needsAttention(agent)) {
      const phase = pulsePhase(
        paint,
        1,
        paint.scene.dataset.agents.indexOf(agent) * 0.3,
      );
      context.strokeStyle = withAlpha(colour, 1 - phase);
      context.lineWidth = pixels(paint, 1.8);
      context.beginPath();
      context.arc(
        position.x,
        position.y,
        pixels(paint, 12) + phase * pixels(paint, 18),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    const textX = position.x + pixels(paint, 13 * scale);
    if (showsAgentName(paint, agent))
      label(paint, agent.name, textX, position.y - pixels(paint, 6), {
        size: agentLabelSize(agent, 11),
        font: type.display,
        colour: palette.ink,
      });
    if (showsAgentStatus(paint, agent)) {
      label(
        paint,
        doctorStatusNames[agent.status],
        textX,
        position.y + pixels(paint, 7),
        { size: agentLabelSize(agent, 9.5), font: type.mono, colour },
      );
    }
  },

  effect(paint, effect, progress) {
    const { palette, shade, accent } = toneOf(paint.lighting);
    const { context, scene, time, reducedMotion } = paint;
    const fadeOut = Math.min(1, (1 - progress) * 5);
    if (effect.kind === "message") {
      const fromClient = clientIdOfAgent(paint, effect.from);
      const toClient = clientIdOfAgent(paint, effect.to);
      const from = scene.motions.get(effect.from)?.position;
      const to = scene.motions.get(effect.to)?.position;
      if (!fromClient || !toClient || !from || !to) return;

      if (fromClient === toClient) {
        // Within one hospital: a porter's trolley along a dashed corridor.
        const path = [from, { x: to.x, y: from.y }, to];
        const route = measure(path);
        context.save();
        context.strokeStyle = accent(0.7 * fadeOut);
        context.lineWidth = pixels(paint, 1.4);
        context.setLineDash([pixels(paint, 5), pixels(paint, 4)]);
        polyline(context, path);
        context.stroke();
        context.restore();
        const travel = reducedMotion
          ? 1
          : easeInOut(Math.min(1, progress / 0.8));
        const pose = poseAlong(route, travel * route.total, 6);
        drawTrolley(
          paint,
          pose.position,
          pose.heading,
          Math.max(18, pixels(paint, 12)),
          fadeOut,
        );
        if (isFull(paint)) {
          const middle = poseAlong(route, route.total / 2).position;
          label(
            paint,
            `Porter · ${effect.text}`,
            middle.x,
            middle.y - pixels(paint, 14),
            {
              size: 10,
              font: type.mono,
              colour: shade.labelEffect,
              align: "center",
              alpha: fadeOut,
            },
          );
        }
        return;
      }

      // Between hospitals: an ambulance run along the streets.
      const plan = plansOf(paint);
      const start = plan.spokes.get(fromClient)?.bay;
      const end = plan.spokes.get(toClient)?.bay;
      if (!start || !end) return;
      const path = routeBetween(plan, fromClient, toClient) ?? [start, end];
      const route = measure(path);
      // The route, drawn faintly ahead of the run.
      context.save();
      context.lineJoin = "round";
      context.lineCap = "round";
      context.strokeStyle = accent(0.16 * fadeOut);
      context.lineWidth = Math.max(16, pixels(paint, 6));
      polyline(context, path);
      context.stroke();
      context.strokeStyle = accent(0.55 * fadeOut);
      context.lineWidth = pixels(paint, 1.4);
      context.setLineDash([pixels(paint, 6), pixels(paint, 5)]);
      polyline(context, path);
      context.stroke();
      context.restore();

      // Handing over: from the sender to its bay, and from the far bay on.
      const travel = reducedMotion ? 1 : easeInOut(Math.min(1, progress / 0.8));
      dotted(
        paint,
        from,
        start,
        palette.accent,
        reducedMotion ? 0.5 * fadeOut : Math.max(0, 0.8 - progress * 2),
      );
      dotted(paint, end, to, palette.accent, travel >= 1 ? 0.8 * fadeOut : 0);

      const pose = poseAlong(route, travel * route.total, 22);
      drawAmbulance(
        paint,
        pose.position,
        pose.heading,
        Math.max(46, pixels(paint, 27)),
        { alpha: fadeOut, flashing: !reducedMotion },
      );
      if (isFull(paint)) {
        const middle = poseAlong(route, route.total / 2).position;
        label(
          paint,
          `Ambulance run · ${effect.text}`,
          middle.x,
          middle.y - pixels(paint, 16),
          {
            size: 10,
            font: type.mono,
            colour: shade.labelEffect,
            align: "center",
            alpha: fadeOut,
          },
        );
      }
    } else if (effect.kind === "external") {
      // An air ambulance flies in from beyond the map and lands.
      const target = scene.dataset.items.find(
        (item) => item.id === effect.recordId,
      );
      const point = target
        ? itemPosition(scene.layout, target)
        : scene.layout.fixed.get(effect.recordId);
      if (!point) return;
      const clientId =
        target?.clientId ??
        scene.dataset.requirements.find(
          (requirement) => requirement.id === effect.recordId,
        )?.clientId;
      const plan = clientId ? planOf(paint, clientId) : null;
      if (!plan) return;
      const pad =
        plan.home && plan.carPark
          ? {
              x: (plan.carPark.left + plan.carPark.right) / 2,
              y: (plan.carPark.top + plan.carPark.bottom) / 2,
            }
          : plan.centre;
      const away =
        Math.hypot(pad.x, pad.y) > 1 ? Math.atan2(pad.y, pad.x) : -Math.PI / 2;
      const seen = view(paint, 0);
      const reach = Math.max(seen.right - seen.left, seen.bottom - seen.top);
      const start = {
        x: pad.x + Math.cos(away) * reach * 0.75,
        y: pad.y + Math.sin(away) * reach * 0.75,
      };
      const flight = reducedMotion ? 1 : easeOut(Math.min(1, progress / 0.62));
      const airborne = reducedMotion
        ? 0
        : Math.max(0, Math.min(1, (1 - flight) / 0.3));
      const position = {
        x: start.x + (pad.x - start.x) * flight,
        y: start.y + (pad.y - start.y) * flight,
      };
      const heading = Math.atan2(pad.y - start.y, pad.x - start.x);
      if (flight >= 1) {
        dotted(paint, pad, point, shade.sample, 0.8 * fadeOut);
        const ring = reducedMotion ? 0.5 : Math.min(1, (progress - 0.62) / 0.3);
        context.strokeStyle = withAlpha(shade.sample, (1 - ring) * fadeOut);
        context.lineWidth = pixels(paint, 1.6);
        context.beginPath();
        context.arc(
          point.x,
          point.y,
          pixels(paint, 10) + ring * pixels(paint, 24),
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      drawHelicopter(
        paint,
        position,
        heading,
        Math.max(64, pixels(paint, 34)),
        {
          airborne,
          rotor: reducedMotion ? 0.4 : time * 15,
          alpha: fadeOut,
        },
      );
      if (isFull(paint)) {
        label(
          paint,
          `Air ambulance · ${externalSourceNames[effect.source]}: ${effect.text}`,
          position.x + pixels(paint, 22),
          position.y - pixels(paint, 20),
          {
            size: 10,
            font: type.mono,
            colour: shade.labelEffect,
            alpha: fadeOut,
          },
        );
      }
    } else {
      const motion = scene.motions.get(effect.agentId);
      const agent = scene.dataset.agents.find(
        (candidate) => candidate.id === effect.agentId,
      );
      if (!motion || !agent) return;
      context.strokeStyle = withAlpha(
        palette.status[agent.status],
        1 - progress,
      );
      context.lineWidth = pixels(paint, 2);
      context.beginPath();
      context.arc(
        motion.position.x,
        motion.position.y,
        pixels(paint, 9) + progress * pixels(paint, 38),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  },

  overlay(paint) {
    const { palette, shade, accent } = toneOf(paint.lighting);
    const { context, width, height, scene, camera } = paint;
    // Night falls a little darker towards the edges, never over the centre.
    const edge = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.45,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.8,
    );
    edge.addColorStop(0, `rgba(${shade.vignette},0)`);
    edge.addColorStop(1, `rgba(${shade.vignette},${shade.vignetteAlpha})`);
    context.fillStyle = edge;
    context.fillRect(0, 0, width, height);

    // Signs, on top of everything so a name is never covered. Each sits
    // just inside the top edge of its grounds, towards the outer side, in
    // the band the layout leaves clear of departments and staff.
    const full = isFull(paint);
    const nameSize = full
      ? Math.max(12, Math.min(16, (15 * camera.scale) / 0.4))
      : 11;
    for (const client of scene.dataset.clients) {
      const plan = planOf(paint, client.id);
      if (!plan) continue;
      const { grounds } = plan;
      const topLeft = worldToScreen(camera, {
        x: grounds.left,
        y: grounds.top,
      });
      const bottomRight = worldToScreen(camera, {
        x: grounds.right,
        y: grounds.bottom,
      });
      const room = bottomRight.x - topLeft.x - 12;
      if (client.home === true) {
        // The Practice's own blue-and-white sign, over the ring road at its
        // front, clear of its department.
        const height = nameSize * 1.75;
        const front = worldToScreen(camera, {
          x: plan.centre.x,
          y: plan.centre.y + ringHalf,
        });
        drawSign(paint, {
          x: front.x,
          y: front.y - height / 2,
          name: doctorVocabulary.homeName,
          detail: full ? `Home · ${client.name}` : undefined,
          align: "center",
          maxWidth: room,
          plate: shade.signPlate,
          edge: shade.signEdge,
          nameColour: shade.signName,
          detailColour: shade.signDetail,
          nameSize,
          font: type.display,
          detailFont: type.mono,
        });
        continue;
      }
      const staff = scene.dataset.agents.filter(
        (agent) =>
          !isVessel(agent) && clientIdOfAgent(paint, agent.id) === client.id,
      );
      const onRounds = staff.filter(
        (agent) => agent.status === "running",
      ).length;
      const left = plan.centre.x < -1;
      const right = plan.centre.x > 1;
      // The corner readout floats over the top right of the screen, so a
      // hospital up there signs the side of its grounds nearer the centre.
      const below = right && plan.centre.y < -1;
      const height = nameSize * 1.75;
      drawSign(paint, {
        x: left
          ? topLeft.x + 6
          : right
            ? bottomRight.x - 6
            : (topLeft.x + bottomRight.x) / 2,
        y: below ? bottomRight.y - height - 5 : topLeft.y + 5,
        name: client.name,
        detail: full
          ? `${staff.length} ${doctorVocabulary.agents} · ${onRounds} ${doctorStatusNames.running}`
          : undefined,
        align: left ? "left" : right ? "right" : "center",
        maxWidth: room,
        plate: shade.plate,
        edge: accent(0.75),
        nameColour: palette.ink,
        detailColour: palette.mute,
        nameSize,
        font: type.display,
        detailFont: type.mono,
      });
    }
  },
};
