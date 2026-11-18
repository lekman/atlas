import type { CommanderRequest } from "@atlas/ui/sidebar";
import type { RelayState } from "@atlas/ui/console";

/**
 * The relay state the top bar shows. Live while the worklist answered live
 * in the last few minutes; otherwise queued when done or move requests wait
 * in the phone inbox for the Mac mini; otherwise the stored copy.
 */
export function relayStateOf(
  liveAt: number | null,
  requests: readonly CommanderRequest[],
): RelayState {
  if (liveAt !== null) return { kind: "live" };
  const queued = requests.filter(
    (r) =>
      r.via === "inbox" &&
      r.state === "queued" &&
      (r.action === "done" || r.action === "move"),
  ).length;
  return queued > 0 ? { kind: "queued", count: queued } : { kind: "stored" };
}
