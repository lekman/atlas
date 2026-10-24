/**
 * The words the map writes beside work, and how long they may run.
 *
 * A real backlog item's title is often 80 to 150 characters. Written in
 * full beside its item, it runs past its client's system and off the
 * screen. So the map writes a short form: at most a fixed number of
 * characters, cut at a word where it can, with "…" at the end. The full
 * title stays in the inspector, the HUD, the Details pane and every
 * accessible name.
 */
import type { WorkstreamMarker } from "./layout";

/** The most characters an item's label on the map shows, "…" included. */
export const itemLabelLength = 42;

/** The most characters a workstream marker's title shows, "…" included. */
export const captionLength = 36;

/**
 * How far into the limit a word break must fall to be used. An earlier
 * break would throw away most of the room, so the cut falls mid-word.
 */
const shortestWordCut = 0.6;

/** Characters a cut never ends on, so "…" follows a word. */
const trailing = /[\s,.;:–—-]+$/u;

/**
 * A title cut to at most `limit` characters, with "…" at the end when it
 * was cut. It breaks at the last space that leaves most of the room used,
 * and mid-word only when there is none, as in one very long word. Counts
 * characters, not UTF-16 units, so a cut never splits an emoji.
 */
export function shortenTitle(title: string, limit: number): string {
  const text = title.trim().replace(/\s+/gu, " ");
  const characters = [...text];
  if (characters.length <= limit) return text;
  const room = Math.max(1, limit - 1);
  const head = characters.slice(0, room).join("");
  // A space straight after the head means the head ends on a whole word.
  const wholeWord = characters[room] === " ";
  const space = head.lastIndexOf(" ");
  const kept =
    wholeWord || space < room * shortestWordCut ? head : head.slice(0, space);
  return `${kept.replace(trailing, "") || kept}…`;
}

/** An item's label on the map: its title, shortened. */
export function itemLabel(title: string): string {
  return shortenTitle(title, itemLabelLength);
}

/**
 * The words above a workstream marker: its title, shortened, and how many
 * of its items on the map are not drawn. Plain words in every world. The
 * count is never cut, so a reader always sees how much more there is.
 */
export function workstreamCaption(
  marker: Pick<WorkstreamMarker, "title" | "more">,
  limit: number = captionLength,
): string {
  const title = shortenTitle(marker.title, limit);
  return marker.more > 0 ? `${title} · ${marker.more} more` : title;
}

/**
 * How far above its marker a workstream's caption sits, in world units:
 * clear of the top item in its group, whose label shows only further in.
 */
export const workstreamCaptionRise = 56;

/**
 * How far from its marker, towards the star, a caption starts, in world
 * units. The caption then runs outward over its items, as their labels do.
 */
export const captionInset = 18;

/** The canvas alignment for a label that runs towards `side`. */
export function labelAlign(side: 1 | -1): "left" | "right" {
  return side > 0 ? "left" : "right";
}

/** The SVG text anchor for a label that runs towards `side`. */
export function labelAnchor(side: 1 | -1): "start" | "end" {
  return side > 0 ? "start" : "end";
}
