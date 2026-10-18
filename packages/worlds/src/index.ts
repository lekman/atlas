import { astronomer } from "./astronomer";
import { gardener } from "./gardener";
import { mariner } from "./mariner";
import { woodsman } from "./woodsman";
import type { World } from "./types";

/**
 * Every built world. A new world adds one import above and one key here, and
 * leaves `plannedWorlds`.
 */
export const worlds = {
  astronomer,
  mariner,
  woodsman,
  gardener,
} satisfies Record<string, World>;

export type WorldId = keyof typeof worlds;
export const worldIds = Object.keys(worlds) as WorldId[];

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === "string" && value in worlds;
}

export { astronomer, gardener, mariner, woodsman };
export * from "./camera";
export * from "./layout";
export * from "./paint";
export * from "./planned";
export * from "./scene";
export * from "./sound";
export * from "./svg";
export type * from "./types";
