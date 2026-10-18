/**
 * Every palette a world draws with, day and night, held to the same rules:
 * the shared status hue families, and WCAG AA contrast for everything that
 * is used as text, against the ground and against a panel laid over it.
 */
import { describe, expect, it } from "bun:test";

import {
  describeNight,
  paletteFor,
  resolveLighting,
  worlds,
  type Palette,
  type World,
} from "../src";

type Rgb = [number, number, number];

/** `#rrggbb` or `rgba(r, g, b, a)`, with the alpha. */
function parse(colour: string): { rgb: Rgb; alpha: number } {
  if (colour.startsWith("#")) {
    const value = Number.parseInt(colour.slice(1, 7), 16);
    return {
      rgb: [(value >> 16) & 255, (value >> 8) & 255, value & 255],
      alpha: 1,
    };
  }
  const parts = colour.match(/[\d.]+/g)?.map(Number) ?? [];
  const [r = 0, g = 0, b = 0, alpha = 1] = parts;
  return { rgb: [r, g, b], alpha };
}

/** A translucent colour as it shows over an opaque one. */
function over(top: string, bottom: string): Rgb {
  const front = parse(top);
  const back = parse(bottom).rgb;
  return front.rgb.map(
    (part, index) => part * front.alpha + back[index]! * (1 - front.alpha),
  ) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

function hue(hex: string): number | null {
  const [r, g, b] = parse(hex).rgb.map((part) => part / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return null;
  const delta = max - min;
  const raw =
    max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return (raw * 60 + 360) % 360;
}

const within = (value: number | null, from: number, to: number) =>
  value !== null && value >= from && value <= to;

function palettesOf(world: World): Array<[string, Palette]> {
  const list: Array<[string, Palette]> = [["day", world.palette]];
  if (world.night) list.push(["night", world.night.palette]);
  return list;
}

for (const world of Object.values(worlds)) {
  describe(`${world.name} palettes`, () => {
    for (const [lighting, palette] of palettesOf(world)) {
      it(`${lighting}: keeps the shared status hues`, () => {
        expect(within(hue(palette.status.running), 90, 160)).toBe(true);
        expect(within(hue(palette.status.watching), 190, 230)).toBe(true);
        expect(within(hue(palette.status.waiting), 25, 50)).toBe(true);
        const red = hue(palette.status.blocked);
        expect(red !== null && (red < 10 || red > 340)).toBe(true);
        const errorRed = hue(palette.status.error);
        expect(errorRed !== null && (errorRed < 10 || errorRed > 340)).toBe(
          true,
        );
      });

      it(`${lighting}: text reaches 4.5:1 on the ground and on a panel`, () => {
        const ground = parse(palette.ground).rgb;
        const panel = over(palette.panel, palette.ground);
        const text: Array<[string, string]> = [
          ["ink", palette.ink],
          ["mute", palette.mute],
          // The still map writes the home's name in the accent.
          ["accent", palette.accent],
          ...Object.entries(palette.status),
        ];
        for (const [name, colour] of text) {
          const rgb = parse(colour).rgb;
          const onGround = contrast(rgb, ground);
          const onPanel = contrast(rgb, panel);
          expect({ name, onGround: onGround >= 4.5 }).toEqual({
            name,
            onGround: true,
          });
          expect({ name, onPanel: onPanel >= 4.5 }).toEqual({
            name,
            onPanel: true,
          });
        }
      });

      it(`${lighting}: says whether its ground is dark`, () => {
        const dark = luminance(parse(palette.ground).rgb) < 0.2;
        expect(palette.darkGround).toBe(dark);
      });
    }

    it("night is dark, where there is one", () => {
      if (world.night) expect(world.night.palette.darkGround).toBe(true);
      expect(describeNight(world).length).toBeGreaterThan(5);
    });

    it("draws its day palette at night when it has no night", () => {
      const night = paletteFor(world, "night");
      expect(night).toBe(world.night ? world.night.palette : world.palette);
    });
  });
}

describe("lighting", () => {
  it("follows the device when automatic", () => {
    expect(resolveLighting("automatic", true)).toBe("night");
    expect(resolveLighting("automatic", false)).toBe("day");
  });

  it("keeps a fixed choice whatever the device says", () => {
    expect(resolveLighting("day", true)).toBe("day");
    expect(resolveLighting("night", false)).toBe("night");
  });
});
