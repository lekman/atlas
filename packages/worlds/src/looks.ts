/**
 * The light half of the worlds: names, palettes, typefaces, voices, lighting,
 * sound and ambience, without the painters or the @atlas/core model. A page
 * that only themes itself, such as the sidebar, imports from here.
 */
import { astronomerLook } from "./astronomer/look";
import { doctorLook } from "./doctor/look";
import { gardenerLook } from "./gardener/look";
import { marinerLook } from "./mariner/look";
import { samuraiLook } from "./samurai/look";
import type { WorldLook } from "./types";
import { woodsmanLook } from "./woodsman/look";

/** Every built world's look, in the order of `worlds`. */
const looks = {
  astronomer: astronomerLook,
  mariner: marinerLook,
  woodsman: woodsmanLook,
  gardener: gardenerLook,
  samurai: samuraiLook,
  doctor: doctorLook,
} satisfies Record<string, WorldLook>;

export type WorldId = keyof typeof looks;
export const worldLooks: Record<WorldId, WorldLook> = looks;
export const worldIds = Object.keys(worldLooks) as WorldId[];

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === "string" && value in worldLooks;
}

export * from "./ambience";
export * from "./lighting";
export * from "./planned";
export * from "./sound";
export type * from "./types";
