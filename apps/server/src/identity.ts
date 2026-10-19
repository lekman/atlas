/**
 * Who is calling. A machine proves itself twice: by the Tailscale node its
 * request comes from, and by the token Atlas issued to that node. A person
 * using the web app through Tailscale Serve is named by Serve's identity
 * headers instead.
 *
 * Behind Serve the server sees every caller as 127.0.0.1, and Serve puts the
 * caller's tailnet address in `X-Forwarded-For`, replacing any value the
 * caller sent. That header is trusted only on a loopback connection.
 */
import type { AtlasDatabase } from "./database";
import { machineForToken, type Machine } from "./machines";

/** Looks up the stable id of the Tailscale node that owns an address. */
export type NodeLookup = (address: string) => Promise<string | undefined>;

export type Caller =
  | { kind: "machine"; machine: Machine }
  | { kind: "person"; login: string }
  | { kind: "anonymous" };

export class CallerRefused extends Error {}

const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** The caller's tailnet address: the socket's, or Serve's forwarded one on loopback. */
export function callerAddress(
  request: Request,
  socketAddress: string | undefined,
): string | undefined {
  if (!socketAddress) return undefined;
  if (!loopback.has(socketAddress)) return socketAddress;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || socketAddress;
}

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}

/**
 * Identifies a request. A token that is wrong, revoked or used from another
 * node is refused outright, so a broken setup fails loudly instead of
 * falling back to anonymous.
 */
export async function identify(
  request: Request,
  socketAddress: string | undefined,
  database: AtlasDatabase,
  lookupNode: NodeLookup,
): Promise<Caller> {
  const token = bearerToken(request);
  if (token) {
    const machine = machineForToken(database, token);
    if (!machine) throw new CallerRefused("the token is not valid");
    const address = callerAddress(request, socketAddress);
    const node = address ? await lookupNode(address) : undefined;
    if (node !== machine.nodeStableId)
      throw new CallerRefused("the token belongs to another machine");
    return { kind: "machine", machine };
  }
  const login = request.headers.get("tailscale-user-login");
  if (login) return { kind: "person", login };
  return { kind: "anonymous" };
}

/**
 * Looks up nodes with `tailscale whois`, remembering each answer for a
 * minute so a busy agent does not start a process on every call.
 */
export function tailscaleNodeLookup(
  command = "tailscale",
  rememberFor = 60_000,
): NodeLookup {
  const remembered = new Map<string, { node?: string; until: number }>();
  return async (address) => {
    const now = Date.now();
    const known = remembered.get(address);
    if (known && known.until > now) return known.node;
    let node: string | undefined;
    try {
      const process = Bun.spawn([command, "whois", "--json", address], {
        stdout: "pipe",
        stderr: "ignore",
      });
      const output = await new Response(process.stdout).text();
      if ((await process.exited) === 0) {
        const parsed = JSON.parse(output) as { Node?: { StableID?: unknown } };
        if (typeof parsed.Node?.StableID === "string")
          node = parsed.Node.StableID;
      }
    } catch {
      node = undefined;
    }
    // A failed lookup is retried sooner than a found node is.
    remembered.set(address, {
      node,
      until: now + (node ? rememberFor : 5_000),
    });
    return node;
  };
}
