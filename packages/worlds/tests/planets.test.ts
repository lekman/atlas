/**
 * The Astronomer's workstream planets: a colour that stays with its
 * workstream, spread across the palette, never repeated in one system
 * while the palette has room, and a palette kept clear of the status
 * colours.
 */
import { describe, expect, it } from "bun:test";

import { sampleDataset } from "@atlas/fixtures";

import { astronomer, mariner, workstreamTerm } from "../src";
import {
  mixColour,
  planetColours,
  planetLooks,
} from "../src/astronomer/planets";

type Rgb = [number, number, number];

const rgb = (hex: string): Rgb => {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const linear = (part: number) => {
  const c = part / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(linear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** CIE76 colour difference, through CIE Lab under a D65 white. */
function difference(a: string, b: string): number {
  const lab = (hex: string): Rgb => {
    const [r, g, b] = rgb(hex).map(linear) as Rgb;
    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = (t: number) =>
      t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const ids = (count: number, prefix = "workstream") =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

describe("planet colours", () => {
  it("has 8 to 12 colours, none repeated", () => {
    expect(planetColours.length).toBeGreaterThanOrEqual(8);
    expect(planetColours.length).toBeLessThanOrEqual(12);
    expect(new Set(planetColours).size).toBe(planetColours.length);
  });

  it("shows each colour at 3:1 or more on the dark ground", () => {
    for (const colour of planetColours)
      expect(
        contrast(colour, astronomer.palette.ground),
      ).toBeGreaterThanOrEqual(3);
  });

  it("keeps each colour clear of the status colours, the accent and the requirement planets", () => {
    const reserved = [
      ...Object.values(astronomer.palette.status),
      astronomer.palette.accent,
      "#bde8ff",
      "#1c4f7a",
    ];
    for (const colour of planetColours)
      for (const other of reserved)
        expect(difference(colour, other)).toBeGreaterThanOrEqual(25);
  });

  it("keeps the colours apart from each other", () => {
    for (const colour of planetColours)
      for (const other of planetColours)
        if (colour !== other)
          expect(difference(colour, other)).toBeGreaterThanOrEqual(20);
  });
});

describe("planet looks", () => {
  it("gives a workstream the same look every time", () => {
    const system = ["halcyon-go-live", "halcyon-quality", "halcyon-portal"];
    expect(planetLooks(system)).toEqual(planetLooks([...system]));
    expect(planetLooks(["halcyon-go-live"]).get("halcyon-go-live")).toEqual(
      planetLooks(system).get("halcyon-go-live")!,
    );
  });

  it("spreads different workstreams across the whole palette", () => {
    const counts = new Map<string, number>();
    for (const id of ids(1100)) {
      const colour = planetLooks([id]).get(id)!.colour;
      counts.set(colour, (counts.get(colour) ?? 0) + 1);
    }
    expect(counts.size).toBe(planetColours.length);
    const fair = 1100 / planetColours.length;
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(fair * 0.6);
      expect(count).toBeLessThan(fair * 1.4);
    }
  });

  it("never repeats a colour in one system while the palette has room", () => {
    for (let size = 2; size <= planetColours.length; size++)
      for (let system = 0; system < 40; system++) {
        const looks = planetLooks(ids(size, `system-${system}`));
        const colours = [...looks.values()].map((look) => look.colour);
        expect(new Set(colours).size).toBe(size);
      }
  });

  it("starts the palette again past its last colour", () => {
    const looks = planetLooks(ids(planetColours.length + 3));
    expect(looks.size).toBe(planetColours.length + 3);
    const colours = [...looks.values()].map((look) => look.colour);
    expect(new Set(colours.slice(0, planetColours.length)).size).toBe(
      planetColours.length,
    );
    expect(new Set(colours.slice(planetColours.length)).size).toBe(3);
  });

  it("keeps the first planet's colour whatever follows it", () => {
    const first = planetLooks(["kestrel-partners"]).get("kestrel-partners");
    const withOthers = planetLooks([
      "kestrel-partners",
      "kestrel-governance",
      "kestrel-billing",
    ]).get("kestrel-partners");
    expect(withOthers?.colour).toBe(first!.colour);
  });

  it("varies size a little, and rings some planets but not all", () => {
    const looks = [...planetLooks(ids(200)).values()];
    for (const look of looks) {
      expect(look.size).toBeGreaterThanOrEqual(0.85);
      expect(look.size).toBeLessThanOrEqual(1.15);
    }
    const ringed = looks.filter((look) => look.ring !== null).length;
    expect(ringed).toBeGreaterThan(40);
    expect(ringed).toBeLessThan(110);
  });
});

describe("mixing colours", () => {
  it("moves a colour towards another by a share", () => {
    expect(mixColour("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixColour("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixColour("#204060", "#ffffff", 0.5)).toBe("#90a0b0");
  });
});

describe("the word for a workstream", () => {
  it("is an outer planet round a client's star and a space station round Terra", () => {
    expect(
      workstreamTerm(astronomer.vocabulary, sampleDataset, "halcyon"),
    ).toBe("outer planet");
    expect(
      workstreamTerm(astronomer.vocabulary, sampleDataset, "ashgrove"),
    ).toBe("space station");
  });

  it("is the same word everywhere in a world without a home word", () => {
    expect(workstreamTerm(mariner.vocabulary, sampleDataset, "ashgrove")).toBe(
      "buoy",
    );
    expect(workstreamTerm(mariner.vocabulary, sampleDataset, "halcyon")).toBe(
      "buoy",
    );
  });
});
