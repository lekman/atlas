/**
 * Every gh-events line becomes a signal: an Atlas `signal` event, whether
 * or not it matched a backlog item. Pure: the reader in `github-reader.ts`
 * reads the lines and records what these return.
 *
 * A signal keeps the line's key, kind, event, repository, number and
 * client, the address built from the repository and number, and the ids
 * of the items it matched. Nothing in it is text anyone wrote on GitHub.
 */
import {
  Identifier,
  type AlertSeverity,
  type AlertType,
  type SignalEvent,
} from "@atlas/core";

import type {
  AlertLine,
  CiState,
  EventLine,
  RegistryAlert,
  RegistryItem,
} from "./github-contract";
import { eventText } from "./github-matching";

/**
 * A line as the reader handles it: a pull request, issue or alert line
 * from `events.jsonl`, or a change Atlas saw in `registry.json` itself
 * (`checks_passed`, see `checksPassed`).
 */
export interface Happening {
  key: string;
  event: string;
  kind: "pr" | "issue" | "alert";
  /** `owner/name`, as gh-events wrote it. */
  repo: string;
  number: number;
  client: string | null;
  sha: string | null;
  at: string;
  alertType?: AlertType;
  severity?: AlertSeverity | null;
}

export function fromEventLine(line: EventLine): Happening {
  return {
    key: line.key,
    event: line.event,
    kind: line.kind,
    repo: line.repo,
    number: line.number,
    client: line.client,
    sha: line.sha,
    at: line.at,
  };
}

export function fromAlertLine(line: AlertLine): Happening {
  return {
    key: line.key,
    event: line.event,
    kind: "alert",
    repo: line.repo,
    number: line.number,
    client: line.client,
    sha: null,
    at: line.at,
    alertType: line.alert_type,
    severity: line.severity,
  };
}

/**
 * A pull request whose checks turned green since the registry was last
 * read, as a happening keyed like a gh-events line. gh-events writes no
 * event for passing checks, so Atlas derives one: the merge rule needs
 * it when a pull request is approved before its checks finish. A pull
 * request seen for the first time gives nothing, so a fresh start does
 * not flood the log.
 */
export function checksPassed(
  item: RegistryItem,
  before: { ci: CiState | null } | undefined,
  at: string,
): Happening | undefined {
  if (item.kind !== "pr" || !before || !item.sha) return undefined;
  if (item.ci !== "SUCCESS" || before.ci === "SUCCESS") return undefined;
  return {
    key: `${item.repo}#${item.number}:checks_passed:${item.sha}`,
    event: "checks_passed",
    kind: "pr",
    repo: item.repo,
    number: item.number,
    client: item.client,
    sha: item.sha,
    at,
  };
}

/** The key prefix gh-events gives an alert's events: `owner/name#alert-<type>-<number>`. */
export function alertKeyPrefix(
  repository: string,
  type: AlertType,
  number: number,
): string {
  return `${repository}#alert-${type}-${number}`;
}

/**
 * An alert that was already open when gh-events first read its repository,
 * as a `swept` happening. gh-events writes no `opened` event for those, so
 * Atlas sweeps them once from the registry.
 */
export function sweptAlert(alert: RegistryAlert, at: string): Happening {
  return {
    key: `${alertKeyPrefix(alert.repo, alert.alert_type, alert.number)}:swept`,
    event: "swept",
    kind: "alert",
    repo: alert.repo,
    number: alert.number,
    client: alert.client,
    sha: null,
    at,
    alertType: alert.alert_type,
    severity: alert.severity,
  };
}

const alertPaths: Record<AlertType, string> = {
  dependabot: "security/dependabot",
  code_scanning: "security/code-scanning",
  secret_scanning: "security/secret-scanning",
};

const alertNames: Record<AlertType, string> = {
  dependabot: "Dependabot alert",
  code_scanning: "Code scanning alert",
  secret_scanning: "Secret scanning alert",
};

/** The address of a happening, built from its repository and number, as the contract builds them. */
export function happeningUrl(happening: Happening): string {
  const base = `https://github.com/${happening.repo}`;
  switch (happening.kind) {
    case "pr":
      return `${base}/pull/${happening.number}`;
    case "issue":
      return `${base}/issues/${happening.number}`;
    case "alert":
      return `${base}/${alertPaths[happening.alertType ?? "dependabot"]}/${happening.number}`;
  }
}

/** The text of a signal, from its kind, event, number and severity alone. */
export function signalText(happening: Happening): string {
  if (happening.kind !== "alert") return eventText(happening);
  const name = alertNames[happening.alertType ?? "dependabot"];
  const severity = happening.severity ? ` (${happening.severity})` : "";
  const what = happening.event === "swept" ? "already open" : happening.event;
  return `${name} #${happening.number}${severity} ${what}`;
}

/**
 * The signal event for a happening. A client that is not an Atlas id is
 * left out, so a line the contract allows never fails the event schema.
 */
export function signalOf(
  happening: Happening,
  recordIds: readonly string[],
): SignalEvent {
  const client = Identifier.safeParse(happening.client).success
    ? happening.client
    : null;
  return {
    type: "signal",
    source: "github",
    key: happening.key,
    kind: happening.kind,
    event: happening.event,
    repository: happening.repo,
    number: happening.number,
    client,
    url: happeningUrl(happening),
    recordIds: [...recordIds],
    ...(happening.alertType ? { alertType: happening.alertType } : {}),
    ...(happening.severity !== undefined
      ? { severity: happening.severity }
      : {}),
    at: happening.at,
    text: signalText(happening),
  };
}
