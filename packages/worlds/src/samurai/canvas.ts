/**
 * The Samurai's campaign scroll: sumi ink on rice paper, brushed mountains
 * and mist in the open country, gold leaf kept for a few accents. Clients are
 * clans marked by invented crests, agents are retainers carrying banners in
 * their status colour, decisions are vermilion seals. Home is The Castle.
 *
 * Vermilion appears only on seals, which are square and sit still. Blocked
 * and error stay an agent's own red: its banner, a ring of stakes around it,
 * and the pulsing ring every world gives what needs the reader.
 *
 * At night (Ninja) the same scroll is drawn by moonlight: see `Look`. The
 * lights that come on are pale gold and warm white, never a status hue.
 */
import { externalSourceNames, type Agent, type Client } from "@atlas/core";

import type { Point } from "../camera";
import {
  decisionPosition,
  itemPosition,
  questionPosition,
  rings,
  workPosition,
} from "../layout";
import {
  curveBetween,
  label,
  labelScale,
  pixels,
  pulsePhase,
  setScreenTransform,
  setWorldTransform,
  withAlpha,
} from "../paint";
import { hashString, seededRandom } from "../random";
import type { Palette, PaintContext, WorldPainter } from "../types";
import { arcPoints, curvePoints, paintBrush, swell } from "./brush";
import {
  castleExtent,
  dayCastle,
  drawCastle,
  gate,
  nightCastle,
  traceWindows,
  type CastleColours,
} from "./castle";
import { crestFor, traceCrest } from "./crest";
import {
  samuraiDecoration as decoration,
  samuraiNightDecoration as night,
  samuraiNightPalette as nightPalette,
  samuraiPalette as palette,
  samuraiTypefaces as type,
} from "./palette";
import { sceneryFor, type Pine, type Range } from "./scenery";
import { samuraiStatusNames, samuraiVocabulary } from "./vocabulary";

const isFull = (paint: PaintContext) => paint.detail === "full";

/** Sumi ink at an alpha. */
const ink = (alpha: number) => `rgba(30,27,23,${Math.max(0, alpha)})`;

/**
 * Everything the painter draws in that changes after dark. By day the
 * brushwork and the shadows are both sumi ink on paper. By night (Ninja)
 * the brushwork turns to moonlit silver, what darkens turns to the deep
 * night, gold leaf turns to silver, and the seals' vermilion brightens.
 */
interface Look {
  night: boolean;
  palette: Palette;
  /** Brushwork: lines, borders, rims. */
  ink: (alpha: number) => string;
  /** What darkens: washes, shadows, silhouettes. */
  shade: (alpha: number) => string;
  vermilion: string;
  /** Gold leaf by day, moonlit silver by night. */
  gold: string;
  paper: string;
  scrollPaper: string;
  /** White stones. */
  plaster: string;
  sumi: string;
  petal: string;
  cord: string;
  /** The pole of a standard and of a banner. */
  pole: string;
  /** The disc a crest sits on, and the crest itself. */
  crestGround: string;
  crest: string;
  /** Mist and smoke, as `r,g,b`, and how strongly mist is laid. */
  mist: string;
  mistStrength: number;
  smoke: string;
  castle: CastleColours;
}

const dayLook: Look = {
  night: false,
  palette,
  ink,
  shade: ink,
  vermilion: decoration.vermilion,
  gold: decoration.gold,
  paper: decoration.paper,
  scrollPaper: "#f5ecd6",
  plaster: decoration.plaster,
  sumi: decoration.sumi,
  petal: decoration.petal,
  cord: decoration.cord,
  pole: decoration.sumi,
  crestGround: decoration.paper,
  crest: decoration.sumi,
  mist: "251,248,240",
  mistStrength: 1,
  smoke: "95,88,80",
  castle: dayCastle,
};

const nightLook: Look = {
  night: true,
  palette: nightPalette,
  ink: (alpha) => `rgba(195,203,217,${Math.max(0, alpha * 0.8)})`,
  shade: (alpha) => `rgba(4,5,10,${Math.max(0, Math.min(1, alpha * 2))})`,
  vermilion: night.vermilion,
  gold: night.silver,
  paper: night.paper,
  scrollPaper: night.paper,
  plaster: night.paper,
  sumi: night.sumi,
  petal: night.petal,
  cord: night.cord,
  pole: "#aeb7c8",
  crestGround: "#1d2333",
  crest: "#d8dde7",
  mist: "150,172,210",
  mistStrength: 0.24,
  smoke: "176,187,209",
  castle: nightCastle,
};

const lookOf = (paint: PaintContext): Look =>
  paint.lighting === "night" ? nightLook : dayLook;

/**
 * A label in the shared style. By night it carries a soft halo of the
 * ground, so pale text stays legible over the moon, mist and lantern light.
 */
function text(
  paint: PaintContext,
  words: string,
  x: number,
  y: number,
  options: Parameters<typeof label>[4],
) {
  const look = lookOf(paint);
  if (!look.night) {
    label(paint, words, x, y, options);
    return;
  }
  const { context } = paint;
  context.save();
  context.shadowColor = look.palette.ground;
  context.shadowBlur = 4 * paint.pixelRatio;
  label(paint, words, x, y, options);
  context.restore();
}

/**
 * A paper lantern, lit: a soft pool of light, a pale gold body and a warm
 * white heart, between two dark caps. It breathes a little where motion is
 * allowed, and holds steady under reduced motion. Night only.
 */
function drawLantern(
  paint: PaintContext,
  at: Point,
  size: number,
  seed: number,
) {
  const { context } = paint;
  const breath = paint.reducedMotion
    ? 1
    : 0.9 +
      0.1 *
        Math.sin(paint.time * 1.9 + seed) *
        Math.sin(paint.time * 0.7 + seed * 2.3);
  const glow = context.createRadialGradient(
    at.x,
    at.y,
    0,
    at.x,
    at.y,
    size * 6,
  );
  glow.addColorStop(0, withAlpha(night.lantern, 0.42 * breath));
  glow.addColorStop(0.35, withAlpha(night.lantern, 0.13 * breath));
  glow.addColorStop(1, withAlpha(night.lantern, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(at.x, at.y, size * 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = night.lantern;
  context.beginPath();
  context.ellipse(at.x, at.y, size * 0.78, size, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = withAlpha(night.flame, 0.85 * breath);
  context.beginPath();
  context.ellipse(
    at.x,
    at.y + size * 0.1,
    size * 0.4,
    size * 0.55,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.fillStyle = night.sumi;
  context.fillRect(at.x - size * 0.5, at.y - size * 1.08, size, size * 0.26);
  context.fillRect(at.x - size * 0.5, at.y + size * 0.82, size, size * 0.26);
}

/**
 * A clan's lantern, hung from a post on the edge of its province, on the
 * side that faces The Castle: away from its objectives, seals and name.
 */
function drawProvinceLantern(
  paint: PaintContext,
  clientId: string,
  centre: Point,
  seed: number,
) {
  const { context } = paint;
  const away = paint.scene.layout.away.get(clientId) ?? 0;
  const angle = away + Math.PI;
  // The lantern hangs from the side of its post nearer the crest.
  const side = Math.cos(angle) > 0 ? 1 : -1;
  // Never smaller on screen than a few pixels, so it reads at overview zoom.
  const scale = Math.max(1, pixels(paint, 3.4) / 6);
  const foot = {
    x: centre.x + Math.cos(angle) * (provinceRadius + 6),
    y: centre.y + Math.sin(angle) * (provinceRadius + 6) + 14 * scale,
  };
  const top = { x: foot.x, y: foot.y - 36 * scale };
  const hang = { x: top.x - side * 10 * scale, y: top.y + 11 * scale };
  context.fillStyle = nightLook.shade(0.3);
  context.beginPath();
  context.ellipse(foot.x, foot.y, 10 * scale, 3 * scale, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = withAlpha(nightLook.pole, 0.75);
  context.lineWidth = Math.max(pixels(paint, 1), 1.8 * scale);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(foot.x, foot.y);
  context.lineTo(top.x, top.y);
  context.lineTo(hang.x - side * 2 * scale, top.y);
  context.moveTo(hang.x, top.y);
  context.lineTo(hang.x, hang.y - 5 * scale);
  context.stroke();
  drawLantern(paint, hang, 6 * scale, seed % 7);
}

/**
 * A signal fire on a distant ridge: a brushed rise of ground and a pale
 * gold flame with a warm white heart. It flickers where motion is allowed
 * and dies down as the courier's word arrives. Night only.
 */
function drawSignalFire(paint: PaintContext, at: Point, progress: number) {
  const { context } = paint;
  const life = Math.min(1, (1 - progress) * 2.5);
  if (life <= 0) return;
  const size = pixels(paint, 10);
  const flicker = paint.reducedMotion
    ? 0
    : Math.sin(paint.time * 9) * 0.5 + Math.sin(paint.time * 13.7) * 0.3;
  paintBrush(
    context,
    curvePoints(
      { x: at.x - size * 3.4, y: at.y + size * 1.1 },
      { x: at.x, y: at.y - size * 0.5 },
      { x: at.x + size * 3.4, y: at.y + size * 1.1 },
      14,
    ),
    pixels(paint, 3),
    nightLook.ink(0.7 * life),
    { pressure: swell },
  );
  const glow = context.createRadialGradient(
    at.x,
    at.y,
    0,
    at.x,
    at.y,
    size * 4,
  );
  glow.addColorStop(0, withAlpha(night.lantern, 0.45 * life));
  glow.addColorStop(1, withAlpha(night.lantern, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(at.x, at.y, size * 4, 0, Math.PI * 2);
  context.fill();
  const flame = (scale: number, colour: string) => {
    const tip = at.y - size * 1.9 * scale;
    context.fillStyle = colour;
    context.beginPath();
    context.moveTo(at.x - size * 0.6 * scale, at.y);
    context.quadraticCurveTo(
      at.x - size * 0.7 * scale,
      at.y - size * scale,
      at.x + flicker * size * 0.25 * scale,
      tip,
    );
    context.quadraticCurveTo(
      at.x + size * 0.7 * scale,
      at.y - size * scale,
      at.x + size * 0.6 * scale,
      at.y,
    );
    context.closePath();
    context.fill();
  };
  flame(1, withAlpha(night.lantern, 0.95 * life));
  flame(0.55, withAlpha(night.flame, life));
}

/** One of the small relay lights that carry a signal inward. Night only. */
function drawRelayLight(paint: PaintContext, at: Point, strength: number) {
  if (strength <= 0) return;
  const { context } = paint;
  const size = pixels(paint, 2.2);
  const glow = context.createRadialGradient(
    at.x,
    at.y,
    0,
    at.x,
    at.y,
    size * 4,
  );
  glow.addColorStop(0, withAlpha(night.lantern, 0.4 * strength));
  glow.addColorStop(1, withAlpha(night.lantern, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(at.x, at.y, size * 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = withAlpha(night.flame, strength);
  context.beginPath();
  context.arc(at.x, at.y, size, 0, Math.PI * 2);
  context.fill();
}

/** The keep's windows by night: each one lit, with a soft spill of light. */
function drawWindowGlow(paint: PaintContext, centre: Point) {
  const { context } = paint;
  context.save();
  context.shadowColor = withAlpha(night.lantern, 0.85);
  context.shadowBlur = 7 * paint.camera.scale * paint.pixelRatio;
  context.fillStyle = night.lantern;
  context.beginPath();
  traceWindows(context, centre);
  context.fill();
  context.restore();
}

/**
 * The moon, large and pale, rising behind the highest range: the disc is
 * cut by the ridge, so the mountain stands in front of it. A faint halo and
 * a soft shading on one side; no marks on its face, so nothing can read as
 * a face.
 */
function drawMoon(paint: PaintContext, ranges: Range[]) {
  const range = ranges.reduce<Range | undefined>(
    (best, candidate) => (!best || candidate.top < best.top ? candidate : best),
    undefined,
  );
  if (!range) return;
  const { context } = paint;
  const first = range.ridge[0];
  const last = range.ridge[range.ridge.length - 1];
  if (!first || !last) return;
  const peak = range.ridge.reduce((best, point) =>
    point.y < best.y ? point : best,
  );
  const radius = Math.max(56, Math.min(96, (last.x - first.x) * 0.16));
  const centre = {
    x: peak.x + radius * 0.7,
    y: range.top + radius * 0.15,
  };
  const halo = context.createRadialGradient(
    centre.x,
    centre.y,
    radius * 0.9,
    centre.x,
    centre.y,
    radius * 3.4,
  );
  halo.addColorStop(0, "rgba(200,210,235,0.15)");
  halo.addColorStop(1, "rgba(200,210,235,0)");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(centre.x, centre.y, radius * 3.4, 0, Math.PI * 2);
  context.fill();

  // Only the sky above the ridge shows the disc.
  context.save();
  context.beginPath();
  context.moveTo(first.x - radius * 4, first.y);
  for (const point of range.ridge) context.lineTo(point.x, point.y);
  context.lineTo(last.x + radius * 4, last.y);
  context.lineTo(last.x + radius * 4, range.top - radius * 4);
  context.lineTo(first.x - radius * 4, range.top - radius * 4);
  context.closePath();
  context.clip();
  const face = context.createRadialGradient(
    centre.x - radius * 0.35,
    centre.y - radius * 0.3,
    radius * 0.15,
    centre.x - radius * 0.1,
    centre.y - radius * 0.05,
    radius * 1.05,
  );
  face.addColorStop(0, withAlpha(night.moon, 0.92));
  face.addColorStop(0.7, "rgba(222,220,210,0.86)");
  face.addColorStop(1, "rgba(184,190,204,0.82)");
  context.fillStyle = face;
  context.beginPath();
  context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/** The radius of a clan's province, inside its brushed border. */
const provinceRadius = 132;
const crestRadius = 42;

/** A heavier label for names of places, in the display face. */
function placeName(
  paint: PaintContext,
  text: string,
  x: number,
  y: number,
  size: number,
  colour: string,
  spacing: number,
) {
  const { context } = paint;
  context.save();
  context.font = `600 ${pixels(paint, size)}px ${type.display}`;
  context.fillStyle = colour;
  context.textAlign = "center";
  context.textBaseline = "top";
  if ("letterSpacing" in context)
    (
      context as CanvasRenderingContext2D & { letterSpacing: string }
    ).letterSpacing = `${pixels(paint, spacing)}px`;
  // A soft paper ground under the name keeps it legible over wash and mist.
  const width = context.measureText(text).width;
  context.fillStyle = withAlpha(lookOf(paint).palette.ground, 0.72);
  context.fillRect(
    x - width / 2 - pixels(paint, 6),
    y - pixels(paint, 2),
    width + pixels(paint, 12),
    pixels(paint, size + 5),
  );
  context.fillStyle = colour;
  context.fillText(text, x, y);
  context.restore();
}

function nameSize(paint: PaintContext, largest: number) {
  return isFull(paint)
    ? Math.max(11, Math.min(largest, (largest * paint.camera.scale) / 0.4))
    : 10.5;
}

/* ── Landscape ─────────────────────────────────────────────────────── */

function drawRange(paint: PaintContext, range: Range, seed: number) {
  const { context } = paint;
  const look = lookOf(paint);
  const ink = look.ink;
  const first = range.ridge[0];
  const last = range.ridge[range.ridge.length - 1];
  if (!first || !last) return;
  const strength = 0.27 - range.depth * 0.12;
  const wash = context.createLinearGradient(0, range.top, 0, range.base);
  if (look.night) {
    // By night a range is a silhouette, darker than the sky behind it.
    const dark = 0.86 - range.depth * 0.3;
    wash.addColorStop(0, look.shade(dark / 2));
    wash.addColorStop(0.55, look.shade(dark * 0.32));
    wash.addColorStop(1, look.shade(0));
  } else {
    wash.addColorStop(0, ink(strength));
    wash.addColorStop(0.5, ink(strength * 0.4));
    wash.addColorStop(1, ink(0));
  }
  context.fillStyle = wash;
  context.beginPath();
  context.moveTo(first.x, range.base);
  for (const point of range.ridge) context.lineTo(point.x, point.y);
  context.lineTo(last.x, range.base);
  context.closePath();
  context.fill();
  paintBrush(
    context,
    range.ridge,
    4.8 - range.depth * 2,
    ink(0.6 - range.depth * 0.28),
    {
      pressure: swell,
      dry: 2,
      seed,
    },
  );
  for (const slope of range.slopes)
    paintBrush(context, slope, 2.6, ink(0.2 - range.depth * 0.08));
}

function drawPine(
  context: CanvasRenderingContext2D,
  pine: Pine,
  look: Look = dayLook,
) {
  const { root, height, lean } = pine;
  const along = (t: number): Point => ({
    x: root.x + Math.sin(lean) * height * t + Math.sin(t * 3) * height * 0.04,
    y: root.y - height * t,
  });
  const trunk = Array.from({ length: 9 }, (_, index) => along(index / 8));
  paintBrush(context, trunk, height * 0.07, look.shade(0.62));
  for (const pad of pine.pads) {
    const stem = along(pad.along);
    const centre = { x: stem.x + pad.side * pad.width, y: stem.y };
    context.strokeStyle = look.shade(0.55);
    context.lineWidth = height * 0.018;
    context.beginPath();
    context.moveTo(stem.x, stem.y + 2);
    context.quadraticCurveTo(
      (stem.x + centre.x) / 2,
      stem.y - 4,
      centre.x,
      centre.y,
    );
    context.stroke();
    drawNeedles(context, centre, pad.width, height, look);
  }
}

/**
 * A pad of pine needles as a painter makes it: a pale wash, a fan of short
 * strokes rising from it, and one dark stroke for its underside.
 */
function drawNeedles(
  context: CanvasRenderingContext2D,
  centre: Point,
  width: number,
  height: number,
  look: Look,
) {
  const half = width * 0.55;
  // By night the pad is a dark silhouette and its needles catch the moon.
  context.fillStyle = look.shade(look.night ? 0.4 : 0.13);
  for (const shift of [-0.45, 0, 0.45]) {
    context.beginPath();
    context.ellipse(
      centre.x + shift * half,
      centre.y - width * 0.05,
      half * 0.6,
      width * 0.14,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.strokeStyle = look.ink(look.night ? 0.42 : 0.5);
  context.lineWidth = Math.max(0.6, height * 0.011);
  context.lineCap = "round";
  context.beginPath();
  const needles = 11;
  for (let needle = 0; needle < needles; needle++) {
    const t = needle / (needles - 1);
    const x = centre.x - half * 0.85 + t * half * 1.7;
    const lean = (t - 0.5) * 0.9;
    const length = width * (0.16 + Math.sin(Math.PI * t) * 0.1);
    context.moveTo(x, centre.y + width * 0.02);
    context.lineTo(
      x + Math.sin(lean) * length,
      centre.y - Math.cos(lean) * length,
    );
  }
  context.stroke();
  paintBrush(
    context,
    curvePoints(
      { x: centre.x - half, y: centre.y + width * 0.02 },
      { x: centre.x, y: centre.y + width * 0.12 },
      { x: centre.x + half, y: centre.y },
      10,
    ),
    Math.max(1.2, height * 0.035),
    look.shade(0.62),
    { pressure: swell },
  );
}

function drawMist(
  paint: PaintContext,
  mist: { x: number; y: number; width: number; height: number; phase: number },
) {
  const { context } = paint;
  const drift = paint.reducedMotion
    ? 0
    : Math.sin(paint.time * 0.035 + mist.phase) * 36;
  context.save();
  context.translate(mist.x + drift, mist.y);
  context.scale(1, mist.height / mist.width);
  const radius = mist.width / 2;
  const { mist: colour, mistStrength: strength } = lookOf(paint);
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  glow.addColorStop(0, `rgba(${colour},${0.92 * strength})`);
  glow.addColorStop(0.55, `rgba(${colour},${0.6 * strength})`);
  glow.addColorStop(1, `rgba(${colour},0)`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/** A band of gold-leaf cloud, as on a folding screen. */
function goldCloud(
  context: CanvasRenderingContext2D,
  centre: Point,
  width: number,
  height: number,
  gold: string,
) {
  const left = centre.x - width / 2;
  const right = centre.x + width / 2;
  const top = centre.y - height / 2;
  const bottom = centre.y + height / 2;
  const radius = height / 2;
  const fill = context.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, withAlpha(gold, 0.5));
  fill.addColorStop(1, withAlpha(gold, 0.26));
  context.fillStyle = fill;
  context.beginPath();
  context.moveTo(left + radius, top);
  // A scalloped upper edge, as the clouds on gold screens are drawn.
  const scallops = Math.max(2, Math.round((width - height) / (height * 1.1)));
  const step = (width - height) / scallops;
  for (let index = 0; index < scallops; index++) {
    const from = left + radius + step * index;
    context.quadraticCurveTo(
      from + step / 2,
      top - height * 0.35,
      from + step,
      top,
    );
  }
  context.arc(right - radius, centre.y, radius, -Math.PI / 2, Math.PI / 2);
  context.lineTo(left + radius, bottom);
  context.arc(left + radius, centre.y, radius, Math.PI / 2, (Math.PI * 3) / 2);
  context.closePath();
  context.fill();
  context.strokeStyle = withAlpha(gold, 0.7);
  context.lineWidth = 1;
  context.stroke();
}

/* ── Small shapes ──────────────────────────────────────────────────── */

/** A rolled scroll lying on its side, tied with a cord. `size` is its half length. */
function drawScroll(
  context: CanvasRenderingContext2D,
  centre: Point,
  size: number,
  line: number,
  look: Look,
) {
  const height = size * 0.7;
  context.fillStyle = look.scrollPaper;
  context.strokeStyle = look.sumi;
  context.lineWidth = line;
  context.beginPath();
  context.rect(centre.x - size, centre.y - height / 2, size * 2, height);
  context.fill();
  context.stroke();
  // The rollers: ink by day, a moonlit edge by night.
  context.fillStyle = look.night ? look.pole : look.sumi;
  for (const side of [-1, 1]) {
    context.fillRect(
      centre.x + side * size - size * 0.12,
      centre.y - height * 0.68,
      size * 0.24,
      height * 1.36,
    );
  }
  context.strokeStyle = look.cord;
  context.lineWidth = Math.max(line, size * 0.12);
  context.beginPath();
  context.moveTo(centre.x, centre.y - height / 2);
  context.lineTo(centre.x, centre.y + height / 2);
  context.stroke();
  context.fillStyle = look.cord;
  context.beginPath();
  context.arc(centre.x, centre.y + height * 0.62, size * 0.13, 0, Math.PI * 2);
  context.fill();
}

/** The letter a seal carries: the first letter of the first word that is not an article. */
function sealInitial(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  const word =
    words.find((candidate) => !/^(the|a|an)$/i.test(candidate)) ?? words[0];
  return (word?.[0] ?? "·").toUpperCase();
}

function roundedSquare(
  context: CanvasRenderingContext2D,
  half: number,
  corner: number,
) {
  context.beginPath();
  context.moveTo(-half + corner, -half);
  context.lineTo(half - corner, -half);
  context.quadraticCurveTo(half, -half, half, -half + corner);
  context.lineTo(half, half - corner);
  context.quadraticCurveTo(half, half, half - corner, half);
  context.lineTo(-half + corner, half);
  context.quadraticCurveTo(-half, half, -half, half - corner);
  context.lineTo(-half, -half + corner);
  context.quadraticCurveTo(-half, -half, -half + corner, -half);
  context.closePath();
}

/** Petals that drift down past the keep. Fixed seeds; still under reduced motion. */
const petals = (() => {
  const random = seededRandom(1185);
  return Array.from({ length: 11 }, () => ({
    across: random(),
    offset: random(),
    cycle: 24 + random() * 14,
    sway: random() * Math.PI * 2,
  }));
})();

/** Two pines beside the keep. */
const castlePines: Array<Omit<Pine, "root"> & { dx: number; dy: number }> = [
  {
    dx: 84,
    dy: 36,
    height: 74,
    lean: 0.18,
    pads: [
      { along: 0.45, side: -0.3, width: 34 },
      { along: 0.66, side: 0.32, width: 30 },
      { along: 0.86, side: -0.1, width: 24 },
    ],
  },
  {
    dx: 104,
    dy: 40,
    height: 50,
    lean: 0.3,
    pads: [
      { along: 0.55, side: 0.3, width: 24 },
      { along: 0.84, side: -0.2, width: 18 },
    ],
  },
];

/**
 * What needs the reader: a steady thin ring, so it is never missed between
 * beats, and a pulse that spreads from it (held still under reduced motion).
 */
function attentionRing(
  paint: PaintContext,
  centre: Point,
  radius: number,
  spread: number,
  colour: string,
  phase: number,
) {
  const { context } = paint;
  context.strokeStyle = withAlpha(colour, 0.55);
  context.lineWidth = pixels(paint, 1.2);
  context.beginPath();
  context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = withAlpha(colour, 1 - phase);
  context.lineWidth = pixels(paint, 1.6);
  context.beginPath();
  context.arc(centre.x, centre.y, radius + phase * spread, 0, Math.PI * 2);
  context.stroke();
}

/* ── The retainer ──────────────────────────────────────────────────── */

/**
 * The retainer by night: a figure in dark garb with a close hood whose two
 * cloth tails stream behind, and a thin moonlit edge on the side the moon
 * is on. No face, nothing in its hands. Drawn about the retainer's feet.
 */
function drawShadowFigure(
  paint: PaintContext,
  look: Look,
  size: number,
  facing: number,
  running: boolean,
) {
  const { context } = paint;
  const flutter =
    running && !paint.reducedMotion
      ? Math.sin(paint.time * 5 + size) * size * 0.06
      : 0;
  context.beginPath();
  // The body, narrower than the day's robe, gathered at the ankles.
  context.moveTo(-size * 0.26, -size * 0.2);
  context.lineTo(size * 0.26, -size * 0.2);
  context.quadraticCurveTo(size * 0.4, size * 0.35, size * 0.5, size * 0.95);
  context.lineTo(-size * 0.5, size * 0.95);
  context.quadraticCurveTo(-size * 0.4, size * 0.35, -size * 0.26, -size * 0.2);
  context.closePath();
  // The hood: a round head drawn down into the shoulders.
  context.moveTo(size * 0.25, -size * 0.42);
  context.arc(0, -size * 0.42, size * 0.25, 0, Math.PI * 2);
  context.fillStyle = look.sumi;
  context.fill();
  context.strokeStyle = look.ink(0.85);
  context.lineWidth = pixels(paint, 0.8);
  context.stroke();
  // The hood's tails, streaming behind.
  const back = -facing;
  context.strokeStyle = look.sumi;
  context.lineWidth = Math.max(pixels(paint, 1), size * 0.1);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(back * size * 0.2, -size * 0.48);
  context.quadraticCurveTo(
    back * size * 0.45,
    -size * 0.5 + flutter,
    back * size * 0.7,
    -size * 0.42 - flutter,
  );
  context.moveTo(back * size * 0.2, -size * 0.44);
  context.quadraticCurveTo(
    back * size * 0.42,
    -size * 0.36 - flutter,
    back * size * 0.62,
    -size * 0.28 + flutter,
  );
  context.stroke();
}

function drawRetainer(
  paint: PaintContext,
  agent: Agent,
  position: Point,
  heading: number,
  size: number,
  colour: string,
) {
  const { context } = paint;
  const look = lookOf(paint);
  const running = agent.status === "running";
  const facing = running && Math.cos(heading) < 0 ? -1 : 1;
  const line = pixels(paint, 0.9);
  context.save();
  context.translate(position.x, position.y);

  if (look.night) {
    // A pool of moonlight behind the figure, so a shadow in dark garb still
    // reads as a figure over the dark ground and the mountains.
    context.save();
    context.translate(-size * 0.2 * facing, -size * 0.7);
    context.scale(1, 1.55);
    const pool = context.createRadialGradient(0, 0, 0, 0, 0, size * 1.45);
    pool.addColorStop(0, "rgba(120,136,168,0.5)");
    pool.addColorStop(0.6, "rgba(120,136,168,0.28)");
    pool.addColorStop(1, "rgba(120,136,168,0)");
    context.fillStyle = pool;
    context.beginPath();
    context.arc(0, 0, size * 1.45, 0, Math.PI * 2);
    context.fill();
    context.restore();
  } else {
    // A wash of paper behind the figure so it reads over mountains and mist.
    context.fillStyle = withAlpha(palette.ground, 0.78);
    context.beginPath();
    context.ellipse(
      -size * 0.25 * facing,
      -size * 0.7,
      size * 1.25,
      size * 1.9,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  // The banner on its pole, carried on the back: the status colour.
  const poleX = -size * 0.24 * facing;
  const poleTop = -size * 2.35;
  const flagTop = poleTop + size * 0.08;
  const flagBottom = -size * 0.82;
  const flagWidth = size * 0.95;
  context.save();
  if (agent.status === "error") {
    // Wounded: the pole leans and the banner is torn.
    context.translate(poleX, size * 0.2);
    context.rotate(-0.38 * facing);
    context.translate(-poleX, -size * 0.2);
  }
  context.strokeStyle = look.pole;
  context.lineWidth = Math.max(line, size * 0.1);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(poleX, size * 0.2);
  context.lineTo(poleX, poleTop);
  context.moveTo(poleX, flagTop);
  context.lineTo(poleX - flagWidth * facing, flagTop);
  context.stroke();

  const free = poleX - flagWidth * facing;
  const wave =
    running && !paint.reducedMotion
      ? Math.sin(paint.time * 2.6 + position.x * 0.01) * size * 0.1
      : 0;
  context.fillStyle = colour;
  context.strokeStyle = look.sumi;
  context.lineWidth = line;
  context.beginPath();
  if (agent.status === "idle") {
    // At rest: the banner is furled against its pole.
    const furl = size * 0.3 * facing;
    context.moveTo(poleX, flagTop);
    context.lineTo(poleX - furl, flagTop + size * 0.1);
    context.lineTo(poleX - furl, flagBottom);
    context.lineTo(poleX, flagBottom + size * 0.1);
  } else if (agent.status === "error") {
    const height = flagBottom - flagTop;
    context.moveTo(poleX, flagTop);
    context.lineTo(free, flagTop);
    context.lineTo(free + flagWidth * 0.36 * facing, flagTop + height * 0.55);
    context.lineTo(free + flagWidth * 0.1 * facing, flagBottom);
    context.lineTo(poleX, flagBottom);
  } else {
    context.moveTo(poleX, flagTop);
    context.lineTo(free, flagTop);
    context.quadraticCurveTo(
      free - wave * facing,
      (flagTop + flagBottom) / 2,
      free + wave * 0.4 * facing,
      flagBottom,
    );
    context.lineTo(poleX, flagBottom);
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  if (look.night) {
    drawShadowFigure(paint, look, size, facing, running);
    context.restore();
    return;
  }

  // The figure: a robe and a broad hat, in ink. No face.
  context.fillStyle = decoration.sumi;
  context.beginPath();
  context.moveTo(-size * 0.3, -size * 0.18);
  context.lineTo(size * 0.3, -size * 0.18);
  context.quadraticCurveTo(size * 0.42, size * 0.4, size * 0.62, size * 0.95);
  context.lineTo(-size * 0.62, size * 0.95);
  context.quadraticCurveTo(-size * 0.42, size * 0.4, -size * 0.3, -size * 0.18);
  context.fill();
  context.beginPath();
  context.arc(0, -size * 0.36, size * 0.2, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(-size * 0.56, -size * 0.44);
  context.quadraticCurveTo(0, -size * 0.62, size * 0.56, -size * 0.44);
  context.lineTo(0, -size * 0.84);
  context.closePath();
  context.fill();
  context.restore();
}

/** The Castle's name, below the keep. */
function drawHomeName(paint: PaintContext, home: Client) {
  const centre = paint.scene.layout.clients.get(home.id) ?? { x: 0, y: 0 };
  const below = centre.y + castleExtent.bottom + pixels(paint, 10);
  placeName(
    paint,
    samuraiVocabulary.homeName,
    centre.x,
    below,
    nameSize(paint, 18),
    lookOf(paint).palette.ink,
    isFull(paint) ? 1.5 : 0.5,
  );
  if (isFull(paint)) {
    text(
      paint,
      `Home keep · ${home.name}`,
      centre.x,
      below + pixels(paint, 26),
      {
        size: 11,
        font: type.body,
        colour: lookOf(paint).palette.mute,
        align: "center",
        baseline: "top",
      },
    );
  }
}

/**
 * A clan's name goes on the side of its province away from its objectives,
 * which spread outward from home: below for the upper clans, above for the
 * lower ones.
 */
function drawClanName(paint: PaintContext, client: Client) {
  const centre = paint.scene.layout.clients.get(client.id);
  if (!centre) return;
  const retainers = paint.scene.dataset.agents.filter(
    (agent) =>
      paint.scene.dataset.groups.find((group) => group.id === agent.groupId)
        ?.clientId === client.id,
  ).length;
  const size = nameSize(paint, 17);
  const block =
    pixels(paint, size + 5) + (isFull(paint) ? pixels(paint, 22) : 0);
  const outward = paint.scene.layout.away.get(client.id) ?? -Math.PI / 2;
  // Once work is labelled, the name stands back beyond the objectives' rings.
  const clear =
    isFull(paint) && paint.camera.scale > labelScale.requirement
      ? rings.requirement + rings.orbit + 10
      : provinceRadius;
  const top =
    Math.sin(outward) > 0.2
      ? centre.y - clear - pixels(paint, 8) - block
      : centre.y + clear + pixels(paint, 8);
  placeName(
    paint,
    client.name.toUpperCase(),
    centre.x,
    top,
    size,
    lookOf(paint).palette.ink,
    isFull(paint) ? 2.4 : 0.8,
  );
  if (isFull(paint)) {
    text(
      paint,
      `Clan · ${retainers} ${retainers === 1 ? "retainer" : "retainers"}`,
      centre.x,
      top + pixels(paint, size + 8),
      {
        size: 11,
        font: type.body,
        colour: lookOf(paint).palette.mute,
        align: "center",
        baseline: "top",
      },
    );
  }
}

/* ── The painter ───────────────────────────────────────────────────── */

export const samuraiPainter: WorldPainter = {
  background(paint) {
    const { context, width, height } = paint;
    const look = lookOf(paint);
    setScreenTransform(paint);
    context.fillStyle = look.palette.ground;
    context.fillRect(0, 0, width, height);
    const age = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.78,
    );
    if (look.night) {
      age.addColorStop(0, "rgba(40,48,72,0.18)");
      age.addColorStop(1, "rgba(0,0,4,0.4)");
    } else {
      age.addColorStop(0, "rgba(255,252,242,0)");
      age.addColorStop(1, "rgba(150,118,70,0.16)");
    }
    context.fillStyle = age;
    context.fillRect(0, 0, width, height);

    setWorldTransform(paint);
    const scenery = sceneryFor(paint.scene.layout);

    context.strokeStyle = look.night
      ? "rgba(170,182,210,0.07)"
      : "rgba(125,100,65,0.12)";
    context.lineWidth = pixels(paint, 0.7);
    context.beginPath();
    for (const [from, through, to] of scenery.fibres) {
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo(through.x, through.y, to.x, to.y);
    }
    context.stroke();

    context.fillStyle = withAlpha(look.gold, look.night ? 0.3 : 0.5);
    const least = pixels(paint, 1.1);
    for (const fleck of scenery.flecks) {
      const size = Math.max(least, fleck.size);
      context.fillRect(fleck.x, fleck.y, size, size * 0.7);
    }

    if (look.night) drawMoon(paint, scenery.ranges);
    const ranges = [...scenery.ranges].sort((a, b) => b.depth - a.depth);
    ranges.forEach((range, index) => drawRange(paint, range, index + 3));
    for (const pine of scenery.pines) drawPine(context, pine, look);
    for (const mist of scenery.mists) drawMist(paint, mist);
  },

  overlay(paint) {
    const { context, width, height } = paint;
    if (!isFull(paint)) {
      // The sidebar map shows only names, so they are drawn last, over
      // every retainer, where nothing can hide them.
      setWorldTransform(paint);
      for (const client of paint.scene.dataset.clients) {
        if (client.home === true) drawHomeName(paint, client);
        else drawClanName(paint, client);
      }
      setScreenTransform(paint);
    }
    const look = lookOf(paint);
    context.strokeStyle = withAlpha(look.gold, 0.75);
    context.lineWidth = 1;
    context.strokeRect(8.5, 8.5, width - 17, height - 17);
    context.strokeStyle = look.ink(0.3);
    context.strokeRect(12.5, 12.5, width - 25, height - 25);
  },

  home(paint, home) {
    const { context, time, reducedMotion } = paint;
    const look = lookOf(paint);
    const ink = look.shade;
    const centre = paint.scene.layout.clients.get(home.id) ?? { x: 0, y: 0 };

    if (look.night) {
      // The lit keep throws a little warm light on the night around it.
      const light = context.createRadialGradient(
        centre.x,
        centre.y - 20,
        0,
        centre.x,
        centre.y - 20,
        150,
      );
      light.addColorStop(0, withAlpha(night.lantern, 0.13));
      light.addColorStop(1, withAlpha(night.lantern, 0));
      context.fillStyle = light;
      context.beginPath();
      context.arc(centre.x, centre.y - 20, 150, 0, Math.PI * 2);
      context.fill();
    }
    goldCloud(
      context,
      { x: centre.x - 22, y: centre.y - 62 },
      168,
      26,
      look.gold,
    );
    goldCloud(
      context,
      { x: centre.x + 40, y: centre.y + 6 },
      124,
      18,
      look.gold,
    );

    const ground = context.createRadialGradient(
      centre.x,
      centre.y + castleExtent.bottom,
      0,
      centre.x,
      centre.y + castleExtent.bottom,
      110,
    );
    ground.addColorStop(0, ink(0.2));
    ground.addColorStop(1, ink(0));
    context.fillStyle = ground;
    context.beginPath();
    context.ellipse(
      centre.x,
      centre.y + castleExtent.bottom,
      110,
      18,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();

    for (const pine of castlePines)
      drawPine(
        context,
        {
          ...pine,
          root: { x: centre.x + pine.dx, y: centre.y + pine.dy },
        },
        look,
      );
    drawCastle(context, centre, pixels(paint, 1), look.castle);
    if (look.night) {
      // Every window lit, and a paper lantern either side of the gate.
      drawWindowGlow(paint, centre);
      for (const side of [-1, 1])
        drawLantern(
          paint,
          { x: centre.x + side * gate.lanterns, y: centre.y + gate.lanternY },
          5.5,
          side * 1.7,
        );
    }

    const petalSize = Math.max(3.4, pixels(paint, 2.6));
    context.fillStyle = look.petal;
    for (const petal of petals) {
      const t = reducedMotion
        ? petal.offset
        : (time / petal.cycle + petal.offset) % 1;
      const x =
        centre.x - 110 + petal.across * 220 + Math.sin(t * 7 + petal.sway) * 14;
      const y = centre.y - 118 + t * 175;
      context.save();
      context.globalAlpha = reducedMotion ? 0.85 : Math.sin(Math.PI * t) * 0.9;
      context.translate(x, y);
      context.rotate(t * 9 + petal.sway);
      context.beginPath();
      context.ellipse(0, 0, petalSize, petalSize * 0.58, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    if (isFull(paint)) drawHomeName(paint, home);
  },

  client(paint, client) {
    const { context } = paint;
    const look = lookOf(paint);
    const ink = look.ink;
    const centre = paint.scene.layout.clients.get(client.id);
    if (!centre) return;
    const seed = hashString(client.id);
    const random = seededRandom(seed);

    const wash = context.createRadialGradient(
      centre.x,
      centre.y,
      crestRadius,
      centre.x,
      centre.y,
      provinceRadius + 40,
    );
    wash.addColorStop(0, ink(0.08));
    wash.addColorStop(1, ink(0));
    context.fillStyle = wash;
    context.beginPath();
    context.arc(centre.x, centre.y, provinceRadius + 40, 0, Math.PI * 2);
    context.fill();

    // The border of the province: one brushed, unclosed circle.
    const start = random() * Math.PI * 2;
    paintBrush(
      context,
      arcPoints(centre, provinceRadius, start, start + 5.25, 64, 3, seed),
      7,
      ink(0.5),
      { dry: 2, seed },
    );
    paintBrush(
      context,
      arcPoints(
        centre,
        provinceRadius + 2,
        start + 5.42,
        start + 5.95,
        12,
        2,
        seed + 1,
      ),
      3,
      ink(0.28),
      { pressure: swell },
    );

    context.fillStyle = look.crestGround;
    context.strokeStyle = ink(0.3);
    context.lineWidth = pixels(paint, 0.8);
    context.beginPath();
    context.arc(centre.x, centre.y, crestRadius + 7, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = look.crest;
    context.beginPath();
    traceCrest(context, crestFor(client.id), centre, crestRadius);
    context.fill("evenodd");

    if (look.night) drawProvinceLantern(paint, client.id, centre, seed);
    if (isFull(paint)) drawClanName(paint, client);
  },

  requirement(paint, requirement) {
    const { context } = paint;
    const look = lookOf(paint);
    const point = paint.scene.layout.fixed.get(requirement.id);
    if (!point) return;
    const done = requirement.state === "done";

    context.save();
    context.setLineDash([0, pixels(paint, 6)]);
    context.lineCap = "round";
    context.strokeStyle = look.ink(done ? 0.14 : 0.3);
    context.lineWidth = pixels(paint, 1.8);
    context.beginPath();
    context.arc(point.x, point.y, rings.orbit, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    context.save();
    context.globalAlpha = done ? 0.42 : 1;
    context.fillStyle = look.shade(0.2);
    context.beginPath();
    context.ellipse(point.x, point.y + 11, 17, 5, 0, 0, Math.PI * 2);
    context.fill();
    // An objective: a standard planted on a rise.
    paintBrush(
      context,
      [
        { x: point.x, y: point.y + 12 },
        { x: point.x + 0.4, y: point.y - 4 },
        { x: point.x, y: point.y - 20 },
      ],
      3,
      look.pole,
      { pressure: (t) => 1 - t * 0.5 },
    );
    context.fillStyle = look.paper;
    context.strokeStyle = look.sumi;
    context.lineWidth = pixels(paint, 1);
    context.beginPath();
    context.rect(point.x + 1, point.y - 18, 11, 17);
    context.fill();
    context.stroke();
    context.fillStyle = look.sumi;
    context.fillRect(point.x + 1, point.y - 18, 11, 4);
    context.fillRect(point.x - 1.5, point.y - 20.5, 15, 1.8);
    context.restore();

    // A won objective keeps quiet until the reader is close.
    const labelAt = done ? labelScale.item : labelScale.requirement;
    if (isFull(paint) && paint.camera.scale > labelAt) {
      text(paint, requirement.title, point.x, point.y + 20, {
        size: 12,
        font: type.body,
        colour: done ? lookOf(paint).palette.mute : lookOf(paint).palette.ink,
        align: "center",
        baseline: "top",
      });
    }
  },

  link(paint, item) {
    const { context, scene } = paint;
    const from = item.requirementId
      ? scene.layout.fixed.get(item.requirementId)
      : undefined;
    if (!from) return;
    const to = itemPosition(
      scene.layout,
      item,
      paint.time,
      paint.reducedMotion,
    );
    context.save();
    context.setLineDash([0, pixels(paint, 5)]);
    context.lineCap = "round";
    context.strokeStyle = lookOf(paint).ink(0.26);
    context.lineWidth = pixels(paint, 1.4);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
  },

  item(paint, item) {
    const { context, scene } = paint;
    const point = itemPosition(
      scene.layout,
      item,
      paint.time,
      paint.reducedMotion,
    );
    // A campaign is a stone on the board: black under way, white not begun,
    // half and half in review.
    const radius = item.priority === "high" ? 8.5 : 6.5;
    const look = lookOf(paint);
    context.save();
    context.globalAlpha = item.state === "done" ? 0.42 : 1;
    context.fillStyle = look.shade(0.16);
    context.beginPath();
    context.ellipse(
      point.x + 1.2,
      point.y + radius * 0.75,
      radius,
      radius * 0.4,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    if (item.state === "doing") {
      const shine = context.createRadialGradient(
        point.x - radius * 0.35,
        point.y - radius * 0.4,
        radius * 0.1,
        point.x,
        point.y,
        radius,
      );
      shine.addColorStop(0, "#625b51");
      shine.addColorStop(1, "#141210");
      context.fillStyle = shine;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      if (look.night) {
        // A black stone on a dark ground keeps a moonlit edge.
        context.strokeStyle = look.ink(0.7);
        context.lineWidth = pixels(paint, 1);
        context.stroke();
      }
    } else {
      context.fillStyle = look.plaster;
      context.strokeStyle = look.sumi;
      context.lineWidth = pixels(paint, 1);
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      if (item.state === "review") {
        context.fillStyle = look.sumi;
        context.beginPath();
        context.arc(point.x, point.y, radius, Math.PI / 2, (Math.PI * 3) / 2);
        context.closePath();
        context.fill();
      }
    }
    if (item.priority === "high") {
      context.strokeStyle = look.ink(0.65);
      context.lineWidth = pixels(paint, 1);
      context.beginPath();
      context.arc(point.x, point.y, radius + 3.6, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.item) {
      text(paint, item.title, point.x + radius + 7, point.y, {
        size: 11.5,
        font: type.body,
        colour: lookOf(paint).palette.ink,
        alpha: 0.92,
      });
    }
  },

  question(paint, question, fade) {
    const { context, scene, time, reducedMotion } = paint;
    const point = questionPosition(
      scene.layout,
      scene.dataset,
      question,
      time,
      reducedMotion,
    );
    const forYou = question.asks === "You";
    const look = lookOf(paint);
    context.save();
    context.globalAlpha = fade;

    const blocked = workPosition(
      scene.layout,
      scene.dataset,
      question.blocks,
      time,
      reducedMotion,
    );
    if (blocked) {
      context.save();
      context.setLineDash([0, pixels(paint, 5)]);
      context.lineCap = "round";
      context.strokeStyle = forYou
        ? withAlpha(look.palette.status.waiting, 0.55)
        : look.ink(0.3);
      context.lineWidth = pixels(paint, 1.4);
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(blocked.x, blocked.y);
      context.stroke();
      context.restore();
    }

    // A thin smoke signal rises from the waiting scroll.
    const sway = reducedMotion ? 0 : time * 0.7;
    const smoke = Array.from({ length: 12 }, (_, index) => {
      const t = index / 11;
      return {
        x: point.x + 3 + Math.sin(t * 4.2 + sway + question.id.length) * 7 * t,
        y: point.y - 8 - t * 50,
      };
    });
    paintBrush(context, smoke, 7, `rgba(${look.smoke},0.2)`, {
      pressure: swell,
    });
    paintBrush(context, smoke, 2.4, `rgba(${look.smoke},0.3)`, {
      pressure: swell,
    });

    drawScroll(context, point, 13, pixels(paint, 1), look);

    if (forYou) {
      const phase = pulsePhase(paint, 0.8, question.id.length * 0.13);
      attentionRing(paint, point, 19, 26, look.palette.status.waiting, phase);
    }
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      text(paint, question.title, point.x + 22, point.y - pixels(paint, 6), {
        size: 11.5,
        font: type.body,
        colour: look.palette.ink,
      });
      text(
        paint,
        `Report for ${question.asks}`,
        point.x + 22,
        point.y + pixels(paint, 8),
        {
          size: 10,
          font: type.mono,
          colour: forYou ? look.palette.status.waiting : look.palette.mute,
          letterSpacing: 0.4,
        },
      );
    }
    context.restore();
  },

  decision(paint, decision, appear) {
    const { context, scene } = paint;
    const point = decisionPosition(scene.layout, scene.dataset, decision);
    const random = seededRandom(hashString(decision.id));
    const half = 11;
    const tilt = (random() - 0.5) * 0.14;
    const made = decision.state === "made";
    const look = lookOf(paint);
    context.save();
    context.globalAlpha = appear;
    if (appear < 1) {
      // The stamp coming down: a faint ring where the paste spreads.
      context.strokeStyle = withAlpha(look.vermilion, (1 - appear) * 0.5);
      context.lineWidth = pixels(paint, 1.2);
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        half * 1.5 + (1 - appear) * 24,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    context.translate(point.x, point.y);
    context.rotate(tilt);
    const press = 1 + (1 - appear) * 0.7;
    context.scale(press, press);
    roundedSquare(context, half, 2.6);
    if (made) {
      context.fillStyle = withAlpha(look.vermilion, 0.92);
      context.fill();
      context.strokeStyle = withAlpha(look.paper, 0.85);
      context.lineWidth = 1.3;
      context.strokeRect(
        -half + 2.6,
        -half + 2.6,
        (half - 2.6) * 2,
        (half - 2.6) * 2,
      );
      context.fillStyle = look.paper;
      context.font = `600 ${half * 1.25}px ${type.display}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(sealInitial(decision.title), 0, 0.8);
      // Where the paste did not take: a few specks of paper.
      context.fillStyle = withAlpha(look.paper, 0.45);
      for (let speck = 0; speck < 7; speck++)
        context.fillRect(
          (random() - 0.5) * half * 1.8,
          (random() - 0.5) * half * 1.8,
          0.8 + random() * 1.2,
          0.6 + random(),
        );
    } else {
      context.setLineDash([2, 2]);
      context.strokeStyle = withAlpha(look.vermilion, 0.75);
      context.lineWidth = 1.3;
      context.stroke();
    }
    context.restore();
    if (isFull(paint) && paint.camera.scale > labelScale.requirement) {
      // The title reads away from the clan's centre, clear of its crest or keep.
      const clan = scene.layout.clients.get(decision.clientId) ?? point;
      const outside = point.x < clan.x ? -1 : 1;
      text(paint, decision.title, point.x + outside * 18, point.y, {
        size: 11.5,
        font: type.body,
        colour: lookOf(paint).palette.ink,
        alpha: appear,
        align: outside < 0 ? "right" : "left",
      });
    }
  },

  agent(paint, agent, motion, colour) {
    const { context } = paint;
    const { position, trail } = motion;
    const full = isFull(paint);
    const size =
      pixels(paint, full ? 9 : 6) * Math.max(1, paint.camera.scale * 1.5);

    if (agent.status === "running" && trail.length > 5) {
      // The trail is a single brush stroke, heavy where the retainer is and
      // lifting away behind.
      const stroke = trail.filter((_, index) => index % 2 === 0);
      if (lookOf(paint).night) {
        // By night it is a wisp of ink smoke: a wide pale drift that curls
        // as it lifts, with a thread of the banner's colour inside it.
        const curl = paint.reducedMotion ? 0 : paint.time * 1.3;
        const wisp = stroke.map((point, index) => {
          const t = index / Math.max(1, stroke.length - 1);
          const lift = (1 - t) * pixels(paint, 4);
          return {
            x: point.x + Math.sin(t * 9 + curl) * lift,
            y: point.y - lift * 0.6,
          };
        });
        paintBrush(context, wisp, pixels(paint, 9), "rgba(176,187,209,0.12)", {
          pressure: swell,
        });
        paintBrush(context, stroke, pixels(paint, 3), withAlpha(colour, 0.3));
      } else {
        paintBrush(context, stroke, pixels(paint, 5), withAlpha(colour, 0.26));
      }
    }

    drawRetainer(paint, agent, position, motion.heading, size, colour);
    const centre = { x: position.x, y: position.y - size * 0.6 };

    if (agent.status === "blocked") {
      // Besieged: a ring of stakes drawn close around the retainer.
      context.strokeStyle = colour;
      context.lineWidth = pixels(paint, 1.5);
      context.lineCap = "round";
      context.beginPath();
      for (let stake = 0; stake < 14; stake++) {
        const angle = (stake / 14) * Math.PI * 2;
        const inner = size * (stake % 2 ? 1.75 : 1.85);
        const outer = size * 2.2;
        context.moveTo(
          centre.x + Math.cos(angle) * inner,
          centre.y + Math.sin(angle) * inner,
        );
        context.lineTo(
          centre.x + Math.cos(angle) * outer,
          centre.y + Math.sin(angle) * outer,
        );
      }
      context.stroke();
    }
    if (paint.scene.needsAttention(agent)) {
      const phase = pulsePhase(
        paint,
        0.9,
        paint.scene.dataset.agents.indexOf(agent) * 0.3,
      );
      attentionRing(
        paint,
        centre,
        size * 2.4,
        pixels(paint, 18),
        colour,
        phase,
      );
    }
    if (!full) return;
    const textX = position.x + size * 0.9 + pixels(paint, 6);
    text(paint, agent.name, textX, position.y - pixels(paint, 6), {
      size: 12,
      font: type.body,
      colour: lookOf(paint).palette.ink,
    });
    if (paint.camera.scale > labelScale.agentStatus) {
      text(
        paint,
        samuraiStatusNames[agent.status],
        textX,
        position.y + pixels(paint, 8),
        {
          size: 10.5,
          font: type.mono,
          colour,
        },
      );
    }
  },

  effect(paint, effect, progress) {
    const { context, scene, time, reducedMotion } = paint;
    const look = lookOf(paint);
    const ink = look.ink;
    const fadeOut = Math.min(1, (1 - progress) * 2);
    if (effect.kind === "message") {
      const from = scene.motions.get(effect.from)?.position;
      const to = scene.motions.get(effect.to)?.position;
      if (!from || !to) return;
      // A messenger: a dashed brush line, and a small scroll carried along it.
      // By night the line is a fine silver dart line, and the scroll darts
      // along it with a streak of moonlight behind.
      const curve = curveBetween(from, to, 0.15);
      const dashes = look.night ? 26 : 18;
      for (let dash = 0; dash < dashes; dash++) {
        const start = dash / dashes;
        paintBrush(
          context,
          curvePoints(from, curve.control, to, 4, start, start + 0.55 / dashes),
          pixels(paint, look.night ? 1.6 : 2.4),
          ink((1 - progress) * 0.6),
        );
      }
      const along = reducedMotion ? 1 : Math.min(1, progress * 1.5);
      const carried = curve.at(along);
      if (look.night && along < 1) {
        const streak = curvePoints(
          from,
          curve.control,
          to,
          10,
          Math.max(0, along - 0.16),
          along,
        );
        paintBrush(context, streak, pixels(paint, 5), ink(0.6), {
          pressure: (t) => Math.pow(t, 0.8),
        });
      }
      drawScroll(context, carried, pixels(paint, 7), pixels(paint, 0.9), look);
      if (isFull(paint)) {
        text(paint, `“${effect.text}”`, curve.control.x, curve.control.y, {
          size: 12,
          font: type.body,
          colour: lookOf(paint).palette.ink,
          align: "center",
          alpha: fadeOut,
        });
      }
    } else if (effect.kind === "external") {
      const target = scene.dataset.items.find(
        (item) => item.id === effect.recordId,
      );
      const point = target
        ? itemPosition(scene.layout, target, time, reducedMotion)
        : scene.layout.fixed.get(effect.recordId);
      if (!point) return;
      const clientId =
        target?.clientId ??
        scene.dataset.requirements.find(
          (requirement) => requirement.id === effect.recordId,
        )?.clientId;
      const centre = (clientId && scene.layout.clients.get(clientId)) || {
        x: 0,
        y: -1,
      };
      const angle = Math.atan2(centre.y || -1, centre.x);
      // By night the signal fire burns a little nearer, so it is in view.
      const reach = look.night ? 480 : 700;
      const start = {
        x: point.x + Math.cos(angle) * reach,
        y: point.y + Math.sin(angle) * reach,
      };
      const travel = reducedMotion ? 1 : Math.min(1, progress * 1.4);
      const length = reach * travel;
      const across = angle + Math.PI / 2;
      if (look.night) {
        // By night the courier is a signal fire lit on a distant ridge, its
        // word passed inward as a line of small relay lights.
        drawSignalFire(paint, start, progress);
        for (let step = 1; step * 70 < length; step++) {
          const along = reach - step * 70;
          const behind = (length - step * 70) / reach;
          drawRelayLight(
            paint,
            {
              x: point.x + Math.cos(angle) * along,
              y: point.y + Math.sin(angle) * along,
            },
            Math.max(0, 1 - behind * 2.2) * fadeOut,
          );
        }
      }
      // A courier from the border: hoof marks in pairs, then a drum signal on arrival.
      context.fillStyle = ink((1 - progress) * (look.night ? 0.3 : 0.6));
      const mark = pixels(paint, 1.6);
      for (let step = 0; step * 24 < length; step++) {
        const along = reach - step * 24;
        const side = step % 2 ? 1 : -1;
        context.beginPath();
        context.arc(
          point.x +
            Math.cos(angle) * along +
            Math.cos(across) * side * pixels(paint, 3),
          point.y +
            Math.sin(angle) * along +
            Math.sin(across) * side * pixels(paint, 3),
          mark,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      const head = {
        x: start.x + (point.x - start.x) * travel,
        y: start.y + (point.y - start.y) * travel,
      };
      if (travel < 1) {
        const pennant = pixels(paint, 11);
        // By night the pennant is lit by the moon: a silver pole, a dark flag.
        context.strokeStyle = look.pole;
        context.lineWidth = pixels(paint, 1.4);
        context.beginPath();
        context.moveTo(head.x, head.y);
        context.lineTo(head.x, head.y - pennant * 1.6);
        context.stroke();
        context.fillStyle = look.night ? look.pole : look.sumi;
        context.beginPath();
        context.moveTo(head.x, head.y - pennant * 1.6);
        context.lineTo(head.x + pennant, head.y - pennant * 1.3);
        context.lineTo(head.x, head.y - pennant);
        context.closePath();
        context.fill();
      } else {
        for (const delay of [0, 0.12]) {
          const spread = Math.max(0, (progress - 0.55 - delay) * 2.4);
          if (spread <= 0) continue;
          paintBrush(
            context,
            arcPoints(
              point,
              pixels(paint, 8) + spread * pixels(paint, 44),
              0,
              Math.PI * 1.9,
              36,
            ),
            pixels(paint, 3 - delay * 8),
            ink((1 - progress) * 0.8),
            { pressure: swell },
          );
        }
      }
      if (isFull(paint)) {
        text(
          paint,
          `Courier · ${externalSourceNames[effect.source]}: ${effect.text}`,
          head.x + pixels(paint, 12),
          head.y - pixels(paint, 14),
          {
            size: 12,
            font: type.body,
            colour: lookOf(paint).palette.ink,
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
      const radius = pixels(paint, 10) + progress * pixels(paint, 36);
      paintBrush(
        context,
        arcPoints(motion.position, radius, -1.2, -1.2 + Math.PI * 1.85, 40),
        pixels(paint, 3),
        withAlpha(lookOf(paint).palette.status[agent.status], 1 - progress),
        { pressure: swell },
      );
    }
  },
};
