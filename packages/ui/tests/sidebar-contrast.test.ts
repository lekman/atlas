import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every sidebar colour drawn as text meets the 4.5:1 minimum (WCAG 2.2 AA)
 * on the three fills text sits on, in both themes. The values are read from
 * the stylesheet itself, so the test cannot drift from what ships.
 */

const css = readFileSync(
  join(import.meta.dirname, "..", "src", "sidebar", "sidebar.css"),
  "utf8",
);

/** The custom properties of the first rule whose selector matches. */
function tokens(selector: RegExp): Record<string, string> {
  const rule = new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`).exec(css);
  if (!rule) throw new Error(`No rule for ${selector}`);
  return Object.fromEntries(
    [...rule[1]!.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
      m[1]!,
      m[2]!.toLowerCase(),
    ]),
  );
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const TEXT = [
  "--ink",
  "--muted",
  "--accent",
  "--warn",
  "--bad",
  "--ok",
  "--yellow",
  "--client-1",
  "--client-2",
  "--client-3",
  "--client-4",
  "--client-5",
  "--client-other",
  "--merged",
];
const FILLS = ["--panel", "--bg", "--now"];

const themes = {
  light: tokens(/\.atlas-sidebar(?=\s*\{)/),
  dark: tokens(/\.atlas-sidebar\[data-theme="dark"\]/),
};

describe("sidebar contrast", () => {
  for (const [name, theme] of Object.entries(themes)) {
    for (const text of TEXT) {
      for (const fill of FILLS) {
        it(`${name}: ${text} on ${fill}`, () => {
          const fg = theme[text];
          const bg = theme[fill];
          expect(fg).toBeDefined();
          expect(bg).toBeDefined();
          expect(ratio(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }

  it("uses the same dark colours with or without the device setting", () => {
    const auto = tokens(/\.atlas-sidebar:not\(\[data-theme="light"\]\)/);
    expect(auto).toEqual(themes.dark);
  });
});
