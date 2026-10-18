import { astronomer } from "./astronomer";
import { mariner } from "./mariner";
import type { World, WorldId } from "./types";

export const worlds: Record<WorldId, World> = { astronomer, mariner };
export const worldIds = Object.keys(worlds) as WorldId[];

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === "string" && value in worlds;
}

export { astronomer, mariner };
export * from "./camera";
export * from "./layout";
export * from "./paint";
export * from "./planned";
export * from "./scene";
export * from "./sound";
export * from "./svg";
export type * from "./types";
