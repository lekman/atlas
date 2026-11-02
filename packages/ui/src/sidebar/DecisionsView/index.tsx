import { useEffect, useId, useRef, useState } from "react";

import {
  judge,
  RULE_MODES,
  verdictText,
  type DecisionRule,
  type Guard,
  type RepeatedAsk,
  type RuleMode,
} from "../decisions/model";
import { formatAgo } from "../format";
import { Icon } from "../Icon";

export interface DecisionsViewProps {
  /** Asks that came up before, with each answer. */
  asks: readonly RepeatedAsk[];
  /** The rules Commander follows now. */
  rules: readonly DecisionRule[];
  /** Kinds of ask that always reach the operator. */
  guards: readonly Guard[];
  /** Make a rule: Commander answers this ask with `then`, in `mode`. */
  onAdopt: (rule: { pattern: string; then: string; mode: RuleMode }) => void;
  /** Stop suggesting a rule for this ask. */
  onKeepAsking: (pattern: string) => void;
  /** Change how a rule acts; "ask" sets it back to asking. */
  onRuleMode: (id: string, mode: RuleMode) => void;
  now: Date;
  onClose: () => void;
}

/**
 * Teach Commander: asks the operator answered the same way again and again
 * become rules Commander follows instead of asking. Asks that touch a guard
 * category always reach the operator. Nothing here answers what waits now.
 */
export function DecisionsView({
  asks,
  rules,
  guards,
  onAdopt,
  onKeepAsking,
  onRuleMode,
  now,
  onClose,
}: DecisionsViewProps) {
  const title = useId();
  const back = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      from?.focus?.();
    };
  }, []);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const open = asks.filter((a) => !rules.some((r) => r.pattern === a.pattern));

  return (
    <div
      className="detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title}
    >
      <div className="inner">
        <div className="dbar">
          <button
            ref={back}
            type="button"
            className="dback"
            aria-label="Back to Atlas"
            onClick={onClose}
          >
            <Icon name="back" />
            <span aria-hidden="true">Back</span>
          </button>
          <div className="dt">
            <h2 id={title}>Teach Commander</h2>
          </div>
        </div>
        <div className="teachv">
          <p className="why">
            Answers you give again and again become rules, so Commander stops
            asking. Nothing here answers what waits now.
          </p>
          <section aria-labelledby={`${title}-asked`}>
            <h3 id={`${title}-asked`}>Asked before</h3>
            {!open.length && (
              <div className="blank">No repeated asks without a rule.</div>
            )}
            <ul>
              {open.map((a) => {
                const v = judge(a, guards);
                const draft =
                  drafts[a.pattern] ??
                  (v.kind === "suggest" || v.kind === "mixed" ? v.answer : "");
                const last = a.answers.at(-1);
                return (
                  <li key={a.pattern}>
                    <div className="q">{a.ask}</div>
                    <div className="sub">
                      {a.from} · asked {a.answers.length} time
                      {a.answers.length === 1 ? "" : "s"}
                      {last && `, last ${formatAgo(new Date(last.on), now)}`}
                    </div>
                    <div className="answers" aria-label="Your answers">
                      {a.answers.slice(-6).map((x, i) => (
                        <span key={`${x.on}-${i}`}>{x.answer}</span>
                      ))}
                    </div>
                    <div className={`verdict ${v.kind}`}>{verdictText(v)}</div>
                    {(v.kind === "suggest" || v.kind === "mixed") && (
                      <>
                        <label className="why">
                          Commander answers{" "}
                          <input
                            type="text"
                            value={draft}
                            aria-label={`Commander's answer to: ${a.ask}`}
                            onChange={(e) =>
                              setDrafts({
                                ...drafts,
                                [a.pattern]: e.target.value,
                              })
                            }
                          />
                        </label>
                        <div className="acts">
                          <button
                            type="button"
                            className={
                              v.kind === "suggest" ? "pri-btn" : "sec-btn"
                            }
                            disabled={!draft.trim()}
                            onClick={() =>
                              onAdopt({
                                pattern: a.pattern,
                                then: draft.trim(),
                                mode: "decide-and-tell",
                              })
                            }
                          >
                            {v.kind === "suggest"
                              ? "Let Commander decide"
                              : "Make it a rule anyway"}
                          </button>
                          <button
                            type="button"
                            className="sec-btn"
                            onClick={() => onKeepAsking(a.pattern)}
                          >
                            Keep asking me
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby={`${title}-rules`}>
            <h3 id={`${title}-rules`}>Rules Commander follows</h3>
            {!rules.length && <div className="blank">No rules yet.</div>}
            <ul>
              {rules.map((r) => (
                <li key={r.id}>
                  <div className="q">
                    {r.when}: {r.then}
                  </div>
                  <div className="sub">
                    {r.used
                      ? `Answered for you ${r.used} time${r.used === 1 ? "" : "s"}`
                      : "Not used yet"}
                    {r.lastUsed &&
                      `, last ${formatAgo(new Date(r.lastUsed), now)}`}
                  </div>
                  <div className="acts">
                    <select
                      aria-label={`How Commander acts: ${r.when}`}
                      value={r.mode}
                      onChange={(e) =>
                        onRuleMode(r.id, e.target.value as RuleMode)
                      }
                    >
                      {RULE_MODES.map((m) => (
                        <option key={m.mode} value={m.mode}>
                          {m.text}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby={`${title}-guards`}>
            <h3 id={`${title}-guards`}>Always asks you</h3>
            <ul>
              {guards.map((g) => (
                <li key={g.category}>
                  <div className="q">{g.category}</div>
                  <div className="why">{g.why}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
