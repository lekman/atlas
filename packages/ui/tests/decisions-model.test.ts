import { describe, expect, it } from "bun:test";

import {
  judge,
  ruleFor,
  verdictText,
  type DecisionRule,
  type RepeatedAsk,
} from "../src/sidebar/decisions/model";

const guards = [{ category: "production", why: "Hospitals run on it" }];
const ask = (answers: string[], touches?: string[]): RepeatedAsk => ({
  pattern: "p",
  ask: "Merge the Dependabot patch?",
  from: "Halcyon",
  answers: answers.map((answer, i) => ({ answer, on: `2026-10-0${i + 1}` })),
  touches,
});

describe("judge", () => {
  it("suggests a rule when one answer wins at least 80% of 3 or more", () => {
    expect(
      judge(ask(["Merge", "merge ", "Merge", "Merge", "Wait"]), guards),
    ).toEqual({
      kind: "suggest",
      answer: "Merge",
      agreed: 4,
      of: 5,
    });
  });
  it("needs three answers", () => {
    expect(judge(ask(["Merge", "Merge"]), guards)).toEqual({
      kind: "too-few",
      of: 2,
    });
  });
  it("calls 2 of 3 mixed", () => {
    expect(judge(ask(["Merge", "Merge", "Wait"]), guards).kind).toBe("mixed");
  });
  it("never suggests a guarded ask, however consistent", () => {
    expect(
      judge(ask(["Go", "Go", "Go", "Go"], ["production"]), guards),
    ).toEqual({
      kind: "guarded",
      categories: ["production"],
    });
  });
  it("ignores categories that are not guards", () => {
    expect(judge(ask(["Go", "Go", "Go"], ["docs"]), guards).kind).toBe(
      "suggest",
    );
  });
  it("says each verdict in words", () => {
    expect(verdictText({ kind: "too-few", of: 1 })).toBe(
      "Asked 1 time; a rule needs 3",
    );
    expect(
      verdictText({ kind: "suggest", answer: "x", agreed: 3, of: 3 }),
    ).toBe("Same answer 3 of 3 times");
  });
});

describe("ruleFor", () => {
  const rules: DecisionRule[] = [
    { id: "a", pattern: "p", when: "", then: "", mode: "ask", used: 0 },
    { id: "b", pattern: "q", when: "", then: "", mode: "decide", used: 2 },
  ];
  it("finds a rule that decides, not one set back to asking", () => {
    expect(ruleFor("p", rules)).toBeUndefined();
    expect(ruleFor("q", rules)?.id).toBe("b");
    expect(ruleFor(undefined, rules)).toBeUndefined();
  });
});
