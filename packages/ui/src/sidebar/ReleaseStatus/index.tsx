import type { CSSProperties } from "react";

import { formatAgo, formatTime } from "../format";
import { Icon } from "../Icon";
import {
  drifts,
  ENVIRONMENTS,
  envStates,
  envText,
  brokenReason,
  releaseLevel,
  stateKind,
  type ReleaseDoc,
} from "../release/model";

export interface ReleaseStatusProps {
  doc: ReleaseDoc | null;
  /** False when `doc` is the stored copy. */
  live: boolean;
  /** The live check's error code and message, if it failed. */
  error?: { code: string; message?: string } | null;
  now: Date;
}

/** Codes that mean the check cannot run on this device at all. */
const ELSEWHERE = new Set([
  "server_not_connected",
  "not_in_manifest",
  "not_granted",
]);

const ICON = { ok: "okc", bad: "badc", gap: "gapc" } as const;

/**
 * One row per drifted repository and one column per environment: green on
 * its head, yellow a gap, red a failed deploy. When nothing drifted, a
 * single line says so.
 */
export function ReleaseStatus({ doc, live, error, now }: ReleaseStatusProps) {
  if (!doc) {
    const text = !error
      ? "checking…"
      : ELSEWHERE.has(error.code)
        ? 'runs only in the Claude desktop app on your MacBook, with the local "dashboard" server installed'
        : `check failed: ${error.message || error.code}`;
    return (
      <section className="panel release" aria-label="Release status">
        <div className="rel">
          <span className={error ? "dot warn" : "dot"} />
          <b>Release status</b>
          <span className="meta">{text}</span>
        </div>
      </section>
    );
  }

  const list = drifts(doc);
  const level = releaseLevel(doc);
  const checked = new Date(doc.checkedAt);
  const title = (
    <>
      <span
        className={`dot ${level}`}
        role="img"
        aria-label={list.length ? "drifted" : "all synced"}
      />
      <b>Release status</b>
      {!list.length && <span>all {doc.total} synced</span>}
      <span className="meta" title={`Release branch ${doc.branch}`}>
        Sync {formatTime(checked)}
        {live ? "" : ` · saved result, ${formatAgo(checked, now)}`}
      </span>
      {!live && error?.code === "tool_error" && (
        <span className="meta failed">· last check failed</span>
      )}
    </>
  );

  if (!list.length) {
    return (
      <section className="panel release" aria-label="Release status">
        <div className="rel">{title}</div>
      </section>
    );
  }

  // An environment nobody reports on gets no column.
  const seen = ENVIRONMENTS.filter((e) =>
    list.some((r) => envStates(r)[e.key]),
  );
  const columns = seen.length ? seen : ENVIRONMENTS;
  return (
    <section className="panel release" aria-label="Release status">
      <div
        className="reltab"
        role="table"
        aria-label="Drifted repositories by environment"
        style={{ "--k": columns.length } as CSSProperties}
      >
        <div className="tr" role="row">
          <div className="rel" role="columnheader">
            {title}
          </div>
          {columns.map((e) => (
            <div
              key={e.key}
              className="eh"
              role="columnheader"
              title={`${e.name}, judged against ${e.base ?? doc.branch}`}
            >
              <span aria-hidden="true">{e.short}</span>
              <span className="sr">{e.name}</span>
            </div>
          ))}
        </div>
        {list.map((repo) => {
          const states = envStates(repo);
          const broken = brokenReason(repo);
          return (
            <div key={repo.repo} className="tr" role="row">
              <div
                className="rn"
                role="cell"
                title={(repo.reasons ?? []).join("; ") || repo.repo}
              >
                {repo.repo}
                {broken && (
                  <span className="tag crit">
                    {/^could/.test(broken)
                      ? "check failed"
                      : "no release branch"}
                  </span>
                )}
              </div>
              {columns.map((e) => {
                const state = states[e.key];
                const what = envText(e, state, doc.branch);
                return (
                  <div key={e.key} className="ec" role="cell" title={what}>
                    {state ? (
                      <span className={stateKind(state)}>
                        <Icon name={ICON[stateKind(state)]} />
                      </span>
                    ) : (
                      <span className="na" aria-hidden="true">
                        –
                      </span>
                    )}
                    <span className="sr">{what}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
