/**
 * Release status as the local server's `release_status` tool sends it: the
 * repositories that have drifted from the release, with each environment's
 * state. Development is judged against main; staging and production
 * against the release branch.
 */

export type EnvState = "ok" | "behind" | "deploying" | "failed" | "none";

export interface DriftedRepo {
  repo: string;
  envs?: Partial<Record<string, EnvState>>;
  /** Why it drifted, in words; the older check has only these. */
  reasons?: string[];
}

/** The tool's answer, and the stored copy (`board/release`), unchanged. */
export interface ReleaseDoc {
  drifted: DriftedRepo[];
  total: number;
  branch: string;
  checkedAt: string;
}

export function isReleaseDoc(value: unknown): value is ReleaseDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { drifted?: unknown }).drifted)
  );
}

export const ENVIRONMENTS: ReadonlyArray<{
  key: string;
  short: string;
  name: string;
  /** What it is judged against; none means the release branch. */
  base: string | null;
}> = [
  { key: "development", short: "DEV", name: "Development", base: "main" },
  { key: "staging", short: "STG", name: "Staging", base: null },
  { key: "production", short: "PRD", name: "Production", base: null },
];

const STATE_TEXT: Record<string, string> = {
  behind: "runs an older commit",
  deploying: "deploying",
  failed: "last deploy failed",
  none: "never deployed",
};

/** A repository the check could not judge: no release branch, or unreadable. */
export function brokenReason(repo: DriftedRepo): string | null {
  return (
    (repo.reasons ?? []).find((r) =>
      /release branch missing|^could not read/.test(r),
    ) ?? null
  );
}

/**
 * Each environment's state. The older check sends only reasons, for
 * staging and production, which are read back into states.
 */
export function envStates(
  repo: DriftedRepo,
): Partial<Record<string, EnvState>> {
  if (repo.envs && Object.keys(repo.envs).length) return repo.envs;
  if (/^could not read/.test(brokenReason(repo) ?? "")) return {};
  const out: Partial<Record<string, EnvState>> = {};
  for (const env of ["staging", "production"]) {
    const reason = (repo.reasons ?? []).find((r) =>
      new RegExp(`^${env} (deploying|last deploy failed|runs )`).test(r),
    );
    out[env] = !reason
      ? "ok"
      : /deploying/.test(reason)
        ? "deploying"
        : /failed/.test(reason)
          ? "failed"
          : "behind";
  }
  return out;
}

const isDrift = (repo: DriftedRepo) =>
  Boolean(brokenReason(repo)) ||
  Object.values(envStates(repo)).some((s) => s && s !== "ok");

/** The repositories that really drifted. */
export function drifts(doc: ReleaseDoc | null): DriftedRepo[] {
  return doc ? doc.drifted.filter(isDrift) : [];
}

/** Red when a deploy failed or a check broke, yellow for a gap, green when all synced. */
export function releaseLevel(doc: ReleaseDoc): "ok" | "yellow" | "bad" {
  const list = drifts(doc);
  if (!list.length) return "ok";
  return list.some(
    (r) => brokenReason(r) || Object.values(envStates(r)).includes("failed"),
  )
    ? "bad"
    : "yellow";
}

/** The release tab's count: drifted repositories, or a tick. */
export function releaseCount(doc: ReleaseDoc | null): string | undefined {
  if (!doc) return undefined;
  const n = drifts(doc).length;
  return n ? String(n) : "✓";
}

/** One cell's words: the environment and its state. */
export function envText(
  env: (typeof ENVIRONMENTS)[number],
  state: EnvState | undefined,
  branch: string,
): string {
  if (!state) return `${env.name}: not deployed here`;
  return `${env.name}: ${state === "ok" ? `on ${env.base ?? branch}` : (STATE_TEXT[state] ?? state)}`;
}

/** The colour group of a state: green on its head, red failed, yellow a gap. */
export const stateKind = (state: EnvState): "ok" | "bad" | "gap" =>
  state === "ok" ? "ok" : state === "failed" ? "bad" : "gap";
