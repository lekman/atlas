/**
 * The two files gh-events writes, as Atlas reads them. gh-events polls
 * GitHub and is the only process that calls it; Atlas reads its files and
 * never calls GitHub. The contract the schemas follow is gh-events' own:
 * version 1 of `registry.json` and version 1 of each `events.jsonl` line.
 *
 * The schemas are a second guard after gh-events' own. A field Atlas does
 * not know is dropped, as the contract asks; a value or an event Atlas
 * does not know makes that item or line skipped and counted. Nothing here
 * keeps a login, a title or a branch name, because the contract never
 * carries them and the schemas do not read the `account` field.
 */
import { z } from "zod/v4";

/** The `registry.json` version and the `events.jsonl` line version Atlas reads. */
export const contractVersion = 1;

/** A repository as `owner/name`, by the contract's own pattern. */
export const RepositoryName = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/);

const Timestamp = z.iso.datetime();
const Sha = z.string().regex(/^[0-9a-f]{40}$/);
const ItemNumber = z.number().int().positive();

export const githubKinds = ["pr", "issue"] as const;
export const pullRequestStates = ["OPEN", "DRAFT"] as const;
export const reviewStates = [
  "APPROVED",
  "CHANGES_REQUESTED",
  "REVIEW_REQUIRED",
] as const;
export const ciStates = [
  "SUCCESS",
  "FAILURE",
  "ERROR",
  "PENDING",
  "EXPECTED",
] as const;
export const mergeableStates = ["MERGEABLE", "CONFLICTING", "UNKNOWN"] as const;

export const CiState = z.enum(ciStates);
export type CiState = z.infer<typeof CiState>;

/** One monitored pull request or issue in `registry.json`. */
export const RegistryItem = z.object({
  kind: z.enum(githubKinds),
  repo: RepositoryName,
  number: ItemNumber,
  client: z.string().nullable(),
  state: z.enum(pullRequestStates),
  review: z.enum(reviewStates).nullable(),
  ci: CiState.nullable(),
  mergeable: z.enum(mergeableStates).nullable(),
  sha: Sha.nullable(),
  closes: z.array(ItemNumber).max(50),
  since: Timestamp,
});
export type RegistryItem = z.infer<typeof RegistryItem>;

/** One configured GitHub account. Only whether its latest poll worked is read. */
const RegistryAccount = z.object({
  ok: z.boolean(),
  polledAt: Timestamp.nullable(),
});

const RegistryFrame = z.object({
  version: z.literal(contractVersion),
  generatedAt: Timestamp,
  intervalSeconds: z.number().int().positive(),
  accounts: z.array(z.unknown()),
  items: z.array(z.unknown()),
});

/** `registry.json` as Atlas keeps it: the valid items, and how many were not. */
export interface Registry {
  generatedAt: string;
  intervalSeconds: number;
  /** Accounts whose latest poll failed or is older than three intervals. */
  accountsStale: number;
  items: RegistryItem[];
  /** Items left out because a value did not match the contract. */
  skipped: number;
}

export type RegistryRead =
  | { kind: "read"; registry: Registry }
  | { kind: "refused"; version: unknown }
  | { kind: "invalid" };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads the text of `registry.json`. A version other than 1 is refused
 * rather than guessed at; a file that is not the contract's shape is
 * invalid; an item with a value Atlas does not know is skipped and counted.
 */
export function parseRegistry(text: string, now: Date): RegistryRead {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { kind: "invalid" };
  }
  if (!isObject(body)) return { kind: "invalid" };
  if (body.version !== contractVersion)
    return { kind: "refused", version: body.version };
  const frame = RegistryFrame.safeParse(body);
  if (!frame.success) return { kind: "invalid" };
  const { generatedAt, intervalSeconds, accounts } = frame.data;
  const oldest = now.getTime() - 3 * intervalSeconds * 1000;
  let accountsStale = 0;
  for (const value of accounts) {
    const account = RegistryAccount.safeParse(value);
    if (
      !account.success ||
      !account.data.ok ||
      account.data.polledAt === null ||
      Date.parse(account.data.polledAt) < oldest
    )
      accountsStale += 1;
  }
  const items: RegistryItem[] = [];
  let skipped = 0;
  for (const value of frame.data.items) {
    const item = RegistryItem.safeParse(value);
    if (item.success) items.push(item.data);
    else skipped += 1;
  }
  return {
    kind: "read",
    registry: { generatedAt, intervalSeconds, accountsStale, items, skipped },
  };
}

/** Whether `generatedAt` is older than three poll intervals, as the contract defines stale. */
export function isStale(registry: Registry, now: Date): boolean {
  return (
    Date.parse(registry.generatedAt) <
    now.getTime() - 3 * registry.intervalSeconds * 1000
  );
}

export const pullRequestEvents = [
  "approved",
  "ci_failed",
  "conflict",
  "merged",
] as const;
export const issueEvents = ["issue_assigned", "issue_closed"] as const;

/** One line of `events.jsonl`. */
export const EventLine = z
  .object({
    v: z.literal(contractVersion),
    key: z.string().min(1).max(512),
    event: z.enum([...pullRequestEvents, ...issueEvents]),
    kind: z.enum(githubKinds),
    repo: RepositoryName,
    number: ItemNumber,
    client: z.string().nullable(),
    sha: Sha.nullable(),
    at: Timestamp,
  })
  .refine(
    (line) =>
      line.kind === "pr"
        ? (pullRequestEvents as readonly string[]).includes(line.event)
        : (issueEvents as readonly string[]).includes(line.event),
    { message: "the event does not belong to the kind" },
  );
export type EventLine = z.infer<typeof EventLine>;

export type EventLineRead =
  { kind: "read"; line: EventLine } | { kind: "refused" } | { kind: "skipped" };

/**
 * Reads one line of `events.jsonl`. A line without `v`, or with a `v`
 * other than 1, is not part of the contract and is refused; a line with a
 * value or an event Atlas does not know is skipped. Both are counted.
 */
export function parseEventLine(text: string): EventLineRead {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { kind: "skipped" };
  }
  if (!isObject(body)) return { kind: "skipped" };
  if (body.v !== contractVersion) return { kind: "refused" };
  const line = EventLine.safeParse(body);
  return line.success ? { kind: "read", line: line.data } : { kind: "skipped" };
}
