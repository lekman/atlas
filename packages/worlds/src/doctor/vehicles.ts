/**
 * The vehicles of the district, drawn from above, facing along +x before
 * they are turned to their heading. No vehicle carries text, a cross or any
 * real service's livery: a plain white van with a light bar and chevrons, a
 * white helicopter with three rotor blades, a porter's trolley.
 */
import type { Point } from "../camera";
import type { PaintContext } from "../types";
import { roundedRectangle } from "./buildings";
import { toneOf } from "./palette";

/**
 * An ambulance from above. Its light bar flashes white and the accent in
 * turn, never a status colour; under reduced motion it holds still and dim.
 */
export function drawAmbulance(
  paint: PaintContext,
  position: Point,
  heading: number,
  length: number,
  options: { alpha: number; flashing: boolean },
): void {
  const { shade, accent } = toneOf(paint.lighting);
  const { context } = paint;
  const width = length * 0.46;
  const half = { x: length / 2, y: width / 2 };
  const flip = Math.floor(paint.time * 7) % 2 === 0;
  context.save();
  context.globalAlpha *= options.alpha;
  context.translate(position.x, position.y);
  context.rotate(heading);

  if (options.flashing) {
    const glow = context.createRadialGradient(
      half.x * 0.35,
      0,
      0,
      half.x * 0.35,
      0,
      length * 1.3,
    );
    glow.addColorStop(0, flip ? accent(0.42) : "rgba(255,255,255,0.32)");
    glow.addColorStop(1, flip ? accent(0) : "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(half.x * 0.35, 0, length * 1.3, 0, Math.PI * 2);
    context.fill();
  }

  // A dark rim so the white body reads on any street.
  roundedRectangle(
    context,
    {
      left: -half.x - 1.5,
      right: half.x + 1.5,
      top: -half.y - 1.5,
      bottom: half.y + 1.5,
    },
    width * 0.3,
  );
  context.fillStyle = shade.rim;
  context.fill();
  roundedRectangle(
    context,
    { left: -half.x, right: half.x, top: -half.y, bottom: half.y },
    width * 0.24,
  );
  context.fillStyle = shade.vehicle;
  context.fill();

  // Chevrons across the rear doors, and a band along each side.
  context.save();
  context.clip();
  context.strokeStyle = accent(0.95);
  context.lineWidth = length * 0.06;
  context.beginPath();
  for (let chevron = 0; chevron < 3; chevron++) {
    const x = -half.x + length * (0.04 + chevron * 0.09);
    context.moveTo(x, -half.y);
    context.lineTo(x + length * 0.08, 0);
    context.lineTo(x, half.y);
  }
  context.stroke();
  context.fillStyle = accent(0.85);
  context.fillRect(-half.x, -half.y, length * 0.72, width * 0.12);
  context.fillRect(-half.x, half.y - width * 0.12, length * 0.72, width * 0.12);
  context.restore();

  // The cab: a windscreen at the front.
  context.fillStyle = shade.glass;
  context.beginPath();
  context.moveTo(half.x - length * 0.2, -half.y * 0.78);
  context.lineTo(half.x - length * 0.07, -half.y * 0.66);
  context.lineTo(half.x - length * 0.07, half.y * 0.66);
  context.lineTo(half.x - length * 0.2, half.y * 0.78);
  context.closePath();
  context.fill();

  // The light bar, in two halves.
  const bar = {
    x: half.x - length * 0.3,
    width: length * 0.08,
    top: -half.y * 0.82,
  };
  const lit = (on: boolean, white: boolean) =>
    !options.flashing
      ? white
        ? "rgba(255,255,255,0.55)"
        : accent(0.55)
      : on
        ? white
          ? "#ffffff"
          : accent(1)
        : "rgba(60,70,95,0.9)";
  context.fillStyle = lit(flip, true);
  context.fillRect(bar.x, bar.top, bar.width, -bar.top);
  context.fillStyle = lit(!flip, false);
  context.fillRect(bar.x, 0, bar.width, -bar.top);
  context.restore();
}

/**
 * A helicopter from above, with three rotor blades (never four, which would
 * make a cross). `airborne` runs 1 → 0 as it comes down onto its pad.
 */
export function drawHelicopter(
  paint: PaintContext,
  position: Point,
  heading: number,
  length: number,
  options: { airborne: number; rotor: number; alpha: number },
): void {
  const { shade, accent } = toneOf(paint.lighting);
  const { context } = paint;
  const lift = options.airborne;
  context.save();
  context.globalAlpha *= options.alpha;

  // Its shadow on the ground, falling away below it as it climbs.
  context.save();
  context.translate(
    position.x + lift * length * 0.7,
    position.y + lift * length,
  );
  context.rotate(heading);
  context.fillStyle = `rgba(0,0,0,${0.35 - lift * 0.15})`;
  context.beginPath();
  context.ellipse(0, 0, length * 0.34, length * 0.18, 0, 0, Math.PI * 2);
  context.fill();
  context.fillRect(
    -length * 0.85,
    -length * 0.03,
    length * 0.55,
    length * 0.06,
  );
  context.restore();

  const scale = 1 + lift * 0.3;
  context.translate(position.x, position.y);
  context.rotate(heading);
  context.scale(scale, scale);

  // Tail boom, fin and tail rotor, with a rim so it reads on a pale roof.
  context.fillStyle = shade.rim;
  context.fillRect(-length * 0.83, -length * 0.05, length * 0.58, length * 0.1);
  context.fillStyle = shade.vehicle;
  context.fillRect(
    -length * 0.82,
    -length * 0.035,
    length * 0.56,
    length * 0.07,
  );
  context.fillStyle = accent(0.9);
  context.fillRect(-length * 0.86, -length * 0.1, length * 0.06, length * 0.2);
  // Skids either side of the cabin.
  context.strokeStyle = "rgba(150,160,185,0.9)";
  context.lineWidth = length * 0.03;
  context.beginPath();
  for (const side of [-1, 1]) {
    context.moveTo(-length * 0.24, side * length * 0.2);
    context.lineTo(length * 0.24, side * length * 0.2);
  }
  context.stroke();
  // The cabin, a band of the accent, and its glass.
  context.fillStyle = shade.rim;
  context.beginPath();
  context.ellipse(0, 0, length * 0.34, length * 0.18, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = shade.vehicle;
  context.beginPath();
  context.ellipse(0, 0, length * 0.32, length * 0.16, 0, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.clip();
  context.fillStyle = accent(0.85);
  context.fillRect(-length * 0.32, -length * 0.03, length * 0.4, length * 0.06);
  context.restore();
  context.fillStyle = shade.glass;
  context.beginPath();
  context.ellipse(
    length * 0.18,
    0,
    length * 0.11,
    length * 0.12,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();

  // The rotor: a faint disc while it turns, and three blades.
  const radius = length * 0.62;
  context.fillStyle = shade.lit
    ? "rgba(220,228,245,0.08)"
    : "rgba(40,48,70,0.06)";
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = shade.rotor;
  context.lineWidth = length * 0.035;
  context.lineCap = "round";
  context.beginPath();
  for (let blade = 0; blade < 3; blade++) {
    const angle = options.rotor + (blade * Math.PI * 2) / 3;
    context.moveTo(0, 0);
    context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  context.stroke();
  context.fillStyle = shade.rim;
  context.beginPath();
  context.arc(0, 0, length * 0.05, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/** A porter's trolley from above: a flat bed, a handle and four wheels. */
export function drawTrolley(
  paint: PaintContext,
  position: Point,
  heading: number,
  length: number,
  alpha: number,
): void {
  const { shade, accent } = toneOf(paint.lighting);
  const { context } = paint;
  const width = length * 0.56;
  context.save();
  context.globalAlpha *= alpha;
  context.translate(position.x, position.y);
  context.rotate(heading);
  context.fillStyle = "#3a4560";
  for (const [x, y] of [
    [-0.38, -0.5],
    [0.38, -0.5],
    [-0.38, 0.5],
    [0.38, 0.5],
  ] as const) {
    context.beginPath();
    context.arc(x * length, y * width, length * 0.08, 0, Math.PI * 2);
    context.fill();
  }
  roundedRectangle(
    context,
    {
      left: -length / 2,
      right: length / 2,
      top: -width / 2,
      bottom: width / 2,
    },
    length * 0.08,
  );
  context.fillStyle = shade.vehicle;
  context.fill();
  context.strokeStyle = accent(0.9);
  context.lineWidth = length * 0.07;
  context.beginPath();
  context.moveTo(-length / 2 - length * 0.08, -width * 0.4);
  context.lineTo(-length / 2 - length * 0.08, width * 0.4);
  context.stroke();
  context.restore();
}
