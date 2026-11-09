/**
 * The dispatcher's rules: what to do about one signal. Pure, so every rule
 * is tested without a network. `dispatcher.ts` runs what these decide.
 *
 * | Rule                | Applies to                                  | Act                                     |
 * | ------------------- | ------------------------------------------- | --------------------------------------- |
 * | `merge-approved`    | `approved` or `checks_passed` on a PR       | Merge by the repository's merge method  |
 * | `fix-failed-checks` | `ci_failed` on a PR the account authored    | Delegate a fix                          |
 * | `alert-by-severity` | `opened` or `swept` on an alert             | Delegate, delegate and ask, or digest   |
 *
 * `nudge-idle-with-work` acts on agents, not on GitHub signals: an agent
 * idle with open work is woken, or you are asked to restart its session
 * (see `idle-with-work.ts` and `decideNudge`).
 *
 * Each rule has a mode: `off` decides nothing, `dry` decides and records
 * the act without doing it, `on` does it.
 */
import type {
  AlertSeverity,
  DispatchRule,
  GithubDispatchRule,
  GithubSignalEvent,
} from "@atlas/core";

import type { RegistryItem } from "./github-contract";
import type { ClaimedTask, IdleFinding } from "./idle-with-work";

export const ruleModes = ["off", "dry", "on"] as const;
export type RuleMode = (typeof ruleModes)[number];

export const mergeMethods = ["squash", "merge", "rebase"] as const;
export type MergeMethod = (typeof mergeMethods)[number];

/** When an agent counts as idle with open work, and how often it is nudged. */
export interface IdleWithWorkSettings {
  /** A live session idle longer than this, in minutes. */
  idleMinutes: number;
  /** No live session for longer than this, in minutes. */
  goneMinutes: number;
  /** At most one nudge per agent in this many minutes. */
  cooldownMinutes: number;
}

export interface DispatcherSettings {
  rules: Record<DispatchRule, RuleMode>;
  /** The merge method when no repository or owner entry names one. */
  defaultMergeMethod: MergeMethod;
  /** Merge methods by `owner/name` or by `owner`, in lower case. */
  mergeMethods: Readonly<Record<string, MergeMethod>>;
  /** A signal older than this is recorded but not acted on. */
  maxAgeHours: number;
  idleWithWork: IdleWithWorkSettings;
}

export const defaultDispatcherSettings: DispatcherSettings = {
  rules: {
    "merge-approved": "dry",
    "fix-failed-checks": "on",
    "alert-by-severity": "on",
    "nudge-idle-with-work": "dry",
  },
  defaultMergeMethod: "squash",
  mergeMethods: {},
  maxAgeHours: 24,
  idleWithWork: { idleMinutes: 20, goneMinutes: 10, cooldownMinutes: 60 },
};

/** What the dispatcher knows about a signal's subject when it decides. */
export interface SignalContext {
  /** The pull request as the latest `registry.json` shows it; absent when it is not open. */
  pullRequest?: RegistryItem;
  /** The account was asked to review this pull request, so it did not author it. */
  reviewRequested: boolean;
  now: Date;
}

/** A task the dispatcher asks the task database to add. */
export interface TaskDraft {
  clientId: string;
  title: string;
  summary: string;
  tags: string[];
  priority: "high" | "normal" | "low";
  /** `owner/name#number`, for a pull request's own task. */
  pullRequests?: string[];
  tracker?: { system: "github"; key: string; url: string };
  /** Ask the reader too: the task waits on them as well as on an agent. */
  needsYou: boolean;
}

interface PlanBase {
  rule: GithubDispatchRule;
  mode: Exclude<RuleMode, "off">;
  needsYou: boolean;
  text: string;
}

/** A decision before it is acted on. Its outcome is one of `DispatchOutcome`, never `fail`. */
export type Plan =
  | (PlanBase & { outcome: "skip" | "digest" })
  | (PlanBase & { outcome: "merge"; method: MergeMethod; sha: string })
  | (PlanBase & {
      outcome: "delegate";
      /** What the delegation is about, so it is not delegated twice while its task is open. */
      subject: string;
      task: TaskDraft;
    });

/** The merge method for a repository: its own entry, then its owner's, then the default. */
export function mergeMethodFor(
  repository: string,
  settings: DispatcherSettings,
): MergeMethod {
  const name = repository.toLowerCase();
  const owner = name.split("/")[0] ?? name;
  return (
    settings.mergeMethods[name] ??
    settings.mergeMethods[owner] ??
    settings.defaultMergeMethod
  );
}

/** The key a delegation's subject is remembered by. */
export function subjectOf(signal: GithubSignalEvent): string {
  const reference = `${signal.repository.toLowerCase()}#${signal.number}`;
  return signal.kind === "alert"
    ? `alert:${signal.alertType ?? "dependabot"}:${reference}`
    : `${signal.kind}:${reference}`;
}

function ruleFor(signal: GithubSignalEvent): GithubDispatchRule | undefined {
  if (
    signal.kind === "pr" &&
    ["approved", "checks_passed"].includes(signal.event)
  )
    return "merge-approved";
  if (signal.kind === "pr" && signal.event === "ci_failed")
    return "fix-failed-checks";
  if (signal.kind === "alert" && ["opened", "swept"].includes(signal.event))
    return "alert-by-severity";
  return undefined;
}

/**
 * The severity an alert is handled at. A secret scanning alert has none,
 * and a leaked secret is urgent, so it counts as high; any other alert
 * without one counts as medium.
 */
export function effectiveSeverity(signal: GithubSignalEvent): AlertSeverity {
  if (signal.severity) return signal.severity;
  return signal.alertType === "secret_scanning" ? "high" : "medium";
}

const alertNames = {
  dependabot: "Dependabot",
  code_scanning: "code scanning",
  secret_scanning: "secret scanning",
} as const;

/** The task's tracker link. An alert's key names it as an alert, so it is never read as a pull request. */
function trackerOf(signal: GithubSignalEvent): TaskDraft["tracker"] {
  const key =
    signal.kind === "alert"
      ? `${signal.repository}:alert-${signal.number}`
      : `${signal.repository}#${signal.number}`;
  return key.length <= 64
    ? { system: "github", key, url: signal.url }
    : undefined;
}

/**
 * What to do about a signal, or `undefined` when no rule applies or the
 * rule is off. A rule that applies but whose conditions do not hold gives
 * a `skip`, with the reason, so every outcome reaches the log.
 */
export function decide(
  signal: GithubSignalEvent,
  context: SignalContext,
  settings: DispatcherSettings,
): Plan | undefined {
  const rule = ruleFor(signal);
  if (!rule) return undefined;
  const mode = settings.rules[rule];
  if (mode === "off") return undefined;
  const skip = (text: string): Plan => ({
    rule,
    mode,
    outcome: "skip",
    needsYou: false,
    text,
  });

  const age = context.now.getTime() - Date.parse(signal.at);
  if (age > settings.maxAgeHours * 3_600_000)
    return skip(
      `Older than ${settings.maxAgeHours} hours, so recorded and not acted on`,
    );

  switch (rule) {
    case "merge-approved": {
      const item = context.pullRequest;
      if (!item)
        return skip(`Pull request #${signal.number} is no longer open`);
      if (item.state !== "OPEN")
        return skip(`Pull request #${signal.number} is a draft`);
      if (item.review !== "APPROVED")
        return skip(`Pull request #${signal.number} is not approved`);
      if (item.ci !== "SUCCESS")
        return skip(`Pull request #${signal.number}: checks are not green`);
      if (item.mergeable === "CONFLICTING")
        return skip(`Pull request #${signal.number} has a merge conflict`);
      if (!item.sha)
        return skip(`Pull request #${signal.number} has no head commit`);
      const method = mergeMethodFor(signal.repository, settings);
      return {
        rule,
        mode,
        outcome: "merge",
        needsYou: false,
        method,
        sha: item.sha,
        text:
          mode === "dry"
            ? `Would merge pull request #${signal.number} by ${method}`
            : `Merge pull request #${signal.number} by ${method}`,
      };
    }
    case "fix-failed-checks": {
      const item = context.pullRequest;
      if (!item)
        return skip(`Pull request #${signal.number} is no longer open`);
      if (item.ci !== "FAILURE" && item.ci !== "ERROR")
        return skip(
          `Pull request #${signal.number}: checks are no longer failing`,
        );
      if (context.reviewRequested)
        return skip(
          `Pull request #${signal.number} is one you were asked to review, not one you opened`,
        );
      if (!signal.client)
        return skip("No client is set for this repository in gh-events");
      const reference = `${signal.repository}#${signal.number}`;
      const tracker = trackerOf(signal);
      return {
        rule,
        mode,
        outcome: "delegate",
        needsYou: false,
        subject: subjectOf(signal),
        task: {
          clientId: signal.client,
          title: `Fix the failing checks on ${reference}`,
          summary: `The checks failed on pull request ${reference}. Find the cause, fix it on the same branch and push. ${signal.url}`,
          tags: ["from-signal", "github"],
          priority: "high",
          pullRequests: [reference],
          ...(tracker ? { tracker } : {}),
          needsYou: false,
        },
        text:
          mode === "dry"
            ? `Would delegate a fix for the failing checks on pull request #${signal.number}`
            : `Delegate a fix for the failing checks on pull request #${signal.number}`,
      };
    }
    case "alert-by-severity": {
      const severity = effectiveSeverity(signal);
      const kind = alertNames[signal.alertType ?? "dependabot"];
      // An alert already open before gh-events read its repository goes to
      // the digest unless it is critical or high.
      const swept = signal.event === "swept";
      if (severity === "low" || (swept && severity === "medium"))
        return {
          rule,
          mode,
          outcome: "digest",
          needsYou: false,
          text: `${severity === "low" ? "Low" : "Medium"} ${kind} alert #${signal.number}${swept ? ", already open," : ""} added to the digest`,
        };
      if (!signal.client)
        return skip("No client is set for this repository in gh-events");
      const needsYou = severity === "critical" || severity === "high";
      const tracker = trackerOf(signal);
      return {
        rule,
        mode,
        outcome: "delegate",
        needsYou,
        subject: subjectOf(signal),
        task: {
          clientId: signal.client,
          title: `Fix the ${severity} ${kind} alert #${signal.number} in ${signal.repository}`,
          summary: `A ${severity} ${kind} alert opened in ${signal.repository}. Fix it in a pull request, or say why it should be dismissed. ${signal.url}`,
          tags: ["from-signal", "github", "security"],
          priority: needsYou ? "high" : "normal",
          ...(tracker ? { tracker } : {}),
          needsYou,
        },
        text: `${mode === "dry" ? "Would delegate" : "Delegate"} a fix for the ${severity} ${kind} alert #${signal.number}${needsYou ? ", and ask you" : ""}`,
      };
    }
  }
}

/** What the nudge rule decides about one agent idle with open work. */
export type NudgePlan =
  | {
      outcome: "wake";
      mode: Exclude<RuleMode, "off">;
      needsYou: false;
      /** The task the session is asked to continue: its earliest claim. */
      task: ClaimedTask;
      /** The fixed message the session is woken with. */
      message: string;
      text: string;
    }
  | {
      outcome: "ask";
      mode: Exclude<RuleMode, "off">;
      needsYou: boolean;
      /** The command that restarts the session, for you to run. */
      command: string;
      text: string;
    };

/** What the nudge rule knows when it decides. */
export interface NudgeContext {
  mode: RuleMode;
  /** When the agent was last nudged, ISO 8601, or null. */
  lastNudgedAt: string | null;
  now: Date;
}

/**
 * The nudge for an agent idle with open work, or `undefined` while the
 * rule is off or the agent was nudged within `cooldownMinutes`.
 *
 * - An idle session is woken through Commander with a fixed message that
 *   names the task to continue.
 * - A gone session is never restarted. You are asked to, with the
 *   `cc-restart` command for the agent's name. In mode `dry` the ask is
 *   recorded without putting it on your list.
 */
export function decideNudge(
  finding: Pick<IdleFinding, "agentName" | "session" | "tasks" | "minutes">,
  context: NudgeContext,
  settings: Pick<IdleWithWorkSettings, "cooldownMinutes">,
): NudgePlan | undefined {
  const mode = context.mode;
  if (mode === "off") return undefined;
  if (
    context.lastNudgedAt &&
    context.now.getTime() - Date.parse(context.lastNudgedAt) <
      settings.cooldownMinutes * 60_000
  )
    return undefined;
  const task = finding.tasks[0];
  if (!task) return undefined;
  if (finding.session === "idle") {
    const message = `Continue ${task.title}: your session has been idle with it open`;
    return {
      outcome: "wake",
      mode,
      needsYou: false,
      task,
      message,
      text: `${mode === "dry" ? "Would wake" : "Wake"} the session to continue ${task.title}`,
    };
  }
  const command = `cc-restart ${finding.agentName}`;
  return {
    outcome: "ask",
    mode,
    needsYou: mode === "on",
    command,
    text:
      mode === "dry"
        ? `Would ask you for a restart: ${command}`
        : `Needs a restart to continue ${task.title}: ${command}`,
  };
}
