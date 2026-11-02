/**
 * Teaching Commander the operator's decisions: asks that come back again and
 * again, the rules that answer them, and the kinds of ask no rule may cover.
 * A prototype for the stories; nothing here is read by Commander yet.
 */

/** An ask that came up before, with how the operator answered it each time. */
export interface RepeatedAsk {
  /** The source's name for the kind of ask, so the same ask groups together. */
  pattern: string;
  /** The ask in words, as it was last put. */
  ask: string;
  /** Who asked: a Commander worker or a client's task. */
  from: string;
  /** Each time it was answered, oldest first. */
  answers: readonly { answer: string; on: string }[];
  /** Guard categories the ask touches, such as "production". */
  touches?: readonly string[];
}

/** How a rule acts when its ask comes up. */
export type RuleMode = "decide" | "decide-and-tell" | "ask";

export const RULE_MODES: readonly { mode: RuleMode; text: string }[] = [
  { mode: "decide", text: "Decide quietly" },
  { mode: "decide-and-tell", text: "Decide and tell me" },
  { mode: "ask", text: "Ask me" },
];

/** A standing answer Commander gives instead of asking. */
export interface DecisionRule {
  id: string;
  pattern: string;
  /** When it applies, in words. */
  when: string;
  /** What Commander does. */
  then: string;
  mode: RuleMode;
  /** How many times it answered for the operator. */
  used: number;
  /** When it last answered, ISO 8601. */
  lastUsed?: string;
}

/** A kind of ask that always reaches the operator, whatever the rules say. */
export interface Guard {
  category: string;
  /** Why, in words. */
  why: string;
}

/** What to do with a repeated ask. */
export type Verdict =
  | { kind: "suggest"; answer: string; agreed: number; of: number }
  | { kind: "too-few"; of: number }
  | { kind: "mixed"; answer: string; agreed: number; of: number }
  | { kind: "guarded"; categories: string[] };

/** Asks before a rule is suggested. */
export const MIN_ASKS = 3;
/** Share of answers that must agree before a rule is suggested. */
export const MIN_AGREEMENT = 0.8;

/**
 * Whether a repeated ask should become a rule. A guard category always wins;
 * then it needs at least MIN_ASKS answers and one answer given at least
 * MIN_AGREEMENT of the time. Answers compare without case or outer spaces.
 */
export function judge(ask: RepeatedAsk, guards: readonly Guard[]): Verdict {
  const guarded = (ask.touches ?? []).filter((t) =>
    guards.some((g) => g.category === t),
  );
  if (guarded.length) return { kind: "guarded", categories: guarded };
  const of = ask.answers.length;
  if (of < MIN_ASKS) return { kind: "too-few", of };
  const counts = new Map<string, { answer: string; n: number }>();
  for (const { answer } of ask.answers) {
    const key = answer.trim().toLowerCase();
    const c = counts.get(key) ?? { answer: answer.trim(), n: 0 };
    c.n += 1;
    c.answer = answer.trim();
    counts.set(key, c);
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n)[0]!;
  return top.n / of >= MIN_AGREEMENT
    ? { kind: "suggest", answer: top.answer, agreed: top.n, of }
    : { kind: "mixed", answer: top.answer, agreed: top.n, of };
}

/** The verdict in words, for the line under the ask. */
export function verdictText(v: Verdict): string {
  switch (v.kind) {
    case "suggest":
      return `Same answer ${v.agreed} of ${v.of} times`;
    case "mixed":
      return `Answers differ: "${v.answer}" ${v.agreed} of ${v.of} times`;
    case "too-few":
      return `Asked ${v.of} time${v.of === 1 ? "" : "s"}; a rule needs ${MIN_ASKS}`;
    case "guarded":
      return `Always asks you: ${v.categories.join(", ")}`;
  }
}

/** The rule that would answer an ask now, if one is in force. */
export function ruleFor(
  pattern: string | undefined,
  rules: readonly DecisionRule[],
): DecisionRule | undefined {
  return pattern
    ? rules.find((r) => r.pattern === pattern && r.mode !== "ask")
    : undefined;
}
