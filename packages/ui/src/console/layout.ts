/**
 * How the console lays itself out, decided from the width it is given, not
 * from the device. The same rules then serve the four places it opens in:
 *
 * | Where                                  | Width        | Layout   |
 * | -------------------------------------- | ------------ | -------- |
 * | The sidebar beside an artifact          | 320 to 759   | `single` |
 * | A folding phone, closed (466 by 678)    | 466          | `single` |
 * | A folding phone, open (890 by 626)      | 890          | `split`  |
 * | A laptop, full page                     | 1200 or more | `wide`   |
 *
 * `single` shows one screen at a time: the section's list, or the selected
 * item with a back link. `split` puts the list and the item side by side on
 * either side of the fold: the left half is exactly half the width, rail
 * included, so nothing crosses the crease. `wide` keeps the list at a
 * reading width and gives the rest to the item.
 */

export const layouts = ["single", "split", "wide"] as const;
export type ConsoleLayout = (typeof layouts)[number];

/** Below this width there is room for one pane only: 760 leaves a 316 px list in `split`. */
export const SPLIT_FROM = 760;
/** From this width a half-and-half split wastes space, so the list keeps a fixed width. */
export const WIDE_FROM = 1200;

export function layoutFor(width: number): ConsoleLayout {
  if (width < SPLIT_FROM) return "single";
  if (width < WIDE_FROM) return "split";
  return "wide";
}

export type RailSide = "left" | "right" | "bottom";

/** Where the swap button moves the menu next: left, then right, then the bottom edge. */
export function nextRailSide(side: RailSide): RailSide {
  return side === "left" ? "right" : side === "right" ? "bottom" : "left";
}

/**
 * The rail's side before the reader picks one. One-handed on a narrow
 * screen the thumb is on the right; held open in two hands, the menu sits
 * at the left, before the list it opens.
 */
export function defaultRailSide(layout: ConsoleLayout): RailSide {
  return layout === "single" ? "right" : "left";
}

const storageKey = (layout: ConsoleLayout) => `atlas-console-rail-${layout}`;

/** The side the reader last chose for this layout, or the default. Storage can be blocked. */
export function rememberedRailSide(layout: ConsoleLayout): RailSide {
  try {
    const value = globalThis.localStorage?.getItem(storageKey(layout));
    if (value === "left" || value === "right" || value === "bottom")
      return value;
  } catch {
    // A private window or blocked storage: the default is fine.
  }
  return defaultRailSide(layout);
}

/** Keeps the reader's choice for this layout. Nothing breaks when it cannot be kept. */
export function rememberRailSide(layout: ConsoleLayout, side: RailSide): void {
  try {
    globalThis.localStorage?.setItem(storageKey(layout), side);
  } catch {
    // Not kept; the choice still holds until the page closes.
  }
}

/** What a relay link is doing, as the top bar says it. */
export type RelayState =
  { kind: "live" } | { kind: "stored" } | { kind: "queued"; count: number };

/** The relay state in words. */
export function relayWords(state: RelayState): string {
  if (state.kind === "live") return "Live";
  if (state.kind === "stored") return "Stored copy";
  return `Queued ${state.count}`;
}
