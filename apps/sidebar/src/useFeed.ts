import {
  describeError,
  UNAUTHORISED,
  type FeedOptions,
  type FeedState,
  type Runtime,
} from "@atlas/runtime";
import { useEffect, useState } from "react";

export interface Feed<T> {
  /** The live answer, or else the stored copy; null before either. */
  data: T | null;
  live: boolean;
  /** Why the live read failed, in words; none for a connector unusable here. */
  error: { text: string; tone: "warn" | "err" } | null;
}

/**
 * A tool watched through the runtime, with its stored copy. `server` names
 * the source in error messages. The options are read once, when the
 * runtime is set.
 */
export function useFeed<T>(
  runtime: Runtime,
  options: FeedOptions<T>,
  server: string,
): Feed<T> {
  const [state, setState] = useState<FeedState<T> | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the options are fixed per call site.
  useEffect(() => runtime.feed<T>(options, setState), [runtime]);
  const error = state?.error;
  return {
    data: state?.live ?? state?.stored ?? null,
    live: Boolean(state?.live),
    // A connector that isn't usable here is not news on the phone; the copy speaks for itself.
    error:
      error && !UNAUTHORISED.has(error.code)
        ? {
            text: describeError(error, server),
            tone: error.code === "server_unavailable" ? "warn" : "err",
          }
        : null,
  };
}
