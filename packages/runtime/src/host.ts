/**
 * The editor the page runs in, when it offers anything of its own. Only the
 * VS Code extension does: it can open a task's details as a tab in its
 * editor area, and tells the page in that tab which task it shows. In the
 * artifact, Storybook or a plain browser there is no host, and the page
 * shows details in the sidebar as it always has.
 */
import type { HostApi, HostMode, RuntimeError } from "./types";
import { toRuntimeError } from "./errors";

/** The host, checked: what the page may rely on. */
export interface Host {
  /** The task this page shows on its own, or null for the sidebar. */
  mode: HostMode | null;
  /** Opens a task's details in a tab of the editor; rejects with a `RuntimeError`. */
  openDetails(ref: string): Promise<void>;
}

/** A mode the page understands, or null for anything else. */
export function readHostMode(value: unknown): HostMode | null {
  if (typeof value !== "object" || value === null) return null;
  const { view, ref } = value as { view?: unknown; ref?: unknown };
  return view === "details" && typeof ref === "string" && ref.trim()
    ? { view, ref }
    : null;
}

/** The host object the runtime gave, checked; null when it is not one. */
export function readHost(api: unknown): Host | null {
  if (typeof api !== "object" || api === null) return null;
  const raw = api as Partial<HostApi>;
  if (typeof raw.openDetails !== "function") return null;
  const open = raw.openDetails.bind(api);
  return {
    mode: readHostMode(raw.mode),
    async openDetails(ref) {
      try {
        await open(ref);
      } catch (error) {
        throw toRuntimeError(error);
      }
    },
  };
}

/** Where a task's details were opened. */
export type DetailsOpened =
  { where: "host" } | { where: "here"; error?: RuntimeError };

/**
 * Opens a task's details in the host's editor when there is a host and the
 * task has a ref, and in the page with `here` otherwise. When the host
 * refuses, the details open in the page after all, so a click is never
 * lost.
 */
export async function openTaskDetails(
  host: Host | null,
  ref: string | undefined,
  here: () => void,
): Promise<DetailsOpened> {
  if (!host || !ref) {
    here();
    return { where: "here" };
  }
  try {
    await host.openDetails(ref);
    return { where: "host" };
  } catch (error) {
    here();
    return { where: "here", error: toRuntimeError(error) };
  }
}
