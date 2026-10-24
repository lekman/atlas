import { astronomer } from "./astronomer";
import { doctor } from "./doctor";
import { gardener } from "./gardener";
import { mariner } from "./mariner";
import { samurai } from "./samurai";
import type { World } from "./types";
import { woodsman } from "./woodsman";

/**
 * Every built world. A new world adds one import above and one key here, and
 * leaves `plannedWorlds`.
 */
export const worlds = {
  astronomer,
  mariner,
  woodsman,
  gardener,
  samurai,
  doctor,
} satisfies Record<string, World>;

export type WorldId = keyof typeof worlds;
export const worldIds = Object.keys(worlds) as WorldId[];

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === "string" && value in worlds;
}

export { astronomer, doctor, gardener, mariner, samurai, woodsman };
export * from "./camera";
export * from "./labels";
export * from "./layout";
export * from "./lighting";
export * from "./paint";
export * from "./planned";
export * from "./scene";
export * from "./ambience";
export * from "./sound";
export * from "./svg";
export type * from "./types";
