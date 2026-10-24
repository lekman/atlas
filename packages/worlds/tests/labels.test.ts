import { describe, expect, it } from "bun:test";

import { crowdedClientId, crowdedDataset } from "@atlas/fixtures";

import {
  captionLength,
  computeLayout,
  itemLabel,
  itemLabelLength,
  shortenTitle,
  workstreamCaption,
} from "../src";

const length = (text: string) => [...text].length;

describe("shortened titles", () => {
  it("leaves a short title as it is", () => {
    expect(shortenTitle("Rehearse the tenant cut-over", 42)).toBe(
      "Rehearse the tenant cut-over",
    );
    expect(shortenTitle("", 42)).toBe("");
  });

  it("leaves a title of exactly the limit as it is", () => {
    const title = "Agree the trailer cut-off times with depots";
    expect(length(title)).toBe(43);
    expect(shortenTitle(title, 43)).toBe(title);
  });

  it("cuts one character over the limit, with an ellipsis", () => {
    const title = "Agree the trailer cut-off times with depots";
    const short = shortenTitle(title, 42);
    expect(short).toBe("Agree the trailer cut-off times with…");
    expect(length(short)).toBeLessThanOrEqual(42);
  });

  it("cuts at a word boundary, with no space or comma before the ellipsis", () => {
    const short = shortenTitle(
      "Write the guide for checking a pallet in, at the dock door, before the peak",
      42,
    );
    expect(short).toBe("Write the guide for checking a pallet in…");
    expect(length(short)).toBeLessThanOrEqual(42);
  });

  it("keeps a whole last word when the cut falls just after it", () => {
    // The first 43 characters end on "and", and the 44th is a space.
    const title = `${"word ".repeat(8)}and more`;
    expect(shortenTitle(title, 44)).toBe(
      "word word word word word word word word and…",
    );
  });

  it("cuts a single very long word mid-word", () => {
    const word = "Supercalifragilisticexpialidocious".repeat(3);
    const short = shortenTitle(word, 42);
    expect(length(short)).toBe(42);
    expect(short.endsWith("…")).toBe(true);
    expect(short.slice(0, 41)).toBe(word.slice(0, 41));
  });

  it("cuts mid-word rather than throw away most of the room", () => {
    const short = shortenTitle(
      "Review thereconciliationandsettlementprocessforallcarriers",
      42,
    );
    expect(short).toBe("Review thereconciliationandsettlementproc…");
  });

  it("never splits an emoji", () => {
    const short = shortenTitle(`${"🚚".repeat(50)}`, 10);
    expect([...short]).toHaveLength(10);
    expect(short).toBe(`${"🚚".repeat(9)}…`);
  });

  it("gathers runs of white space into one", () => {
    expect(shortenTitle("  Test   the  fallback  ", 42)).toBe(
      "Test the fallback",
    );
  });

  it("shortens item labels and captions on the map, never the count", () => {
    const layout = computeLayout(crowdedDataset, "landscape");
    for (const item of crowdedDataset.items) {
      expect(length(itemLabel(item.title))).toBeLessThanOrEqual(
        itemLabelLength,
      );
      if (length(item.title) > itemLabelLength)
        expect(itemLabel(item.title).endsWith("…")).toBe(true);
    }
    const customs = layout.markers.find(
      (marker) => marker.id === "kestrel-customs",
    )!;
    expect(customs.clientId).toBe(crowdedClientId);
    expect(length(customs.title)).toBeGreaterThan(captionLength);
    const caption = workstreamCaption(customs);
    expect(caption).toMatch(/… · \d+ more$/u);
    expect(length(caption.split(" · ")[0]!)).toBeLessThanOrEqual(captionLength);
    expect(workstreamCaption(customs, Number.POSITIVE_INFINITY)).toBe(
      `${customs.title} · ${customs.more} more`,
    );
  });
});
