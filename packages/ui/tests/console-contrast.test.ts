import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every console colour drawn as text meets the 4.5:1 minimum (WCAG 2.2 AA)
 * on every ground text sits on. The values are read from the stylesheet,
 * so the test cannot drift from what ships.
 */

const css = readFileSync(
  join(import.meta.dirname, "..", "src", "console", "console.css"),
  "utf8",
);

const rule = /\.atlas-console\s*\{([^}]*)\}/.exec(css);
if (!rule) throw new Error("No .atlas-console rule");
const tokens: Record<string, string> = Object.fromEntries(
  [...rule[1]!.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
    m[1]!,
    m[2]!.toLowerCase(),
  ]),
);

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

const texts = [
  "--text",
  "--secondary",
  "--label",
  "--amber",
  "--blue",
  "--mint",
  "--coral",
];
const grounds = ["--ground", "--panel", "--card", "--bar"];

describe("console contrast", () => {
  for (const text of texts)
    for (const ground of grounds)
      it(`${text} on ${ground} is at least 4.5:1`, () => {
        expect(ratio(tokens[text]!, tokens[ground]!)).toBeGreaterThanOrEqual(
          4.5,
        );
      });

  it("the count on the blue badge is at least 4.5:1", () => {
    expect(
      ratio(tokens["--ground"]!, tokens["--blue"]!),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
