import { describe, expect, it } from "bun:test";

import { askKey, askOptions } from "../src/sidebar/waiting/model";

describe("askOptions", () => {
  it("puts the recommended option first, drops blanks and repeats, keeps four", () => {
    const options = askOptions({
      kind: "commander",
      options: [
        { label: "Ask Thomas" },
        { label: "  " },
        { label: "Hold", recommended: true, description: "Park it" },
        { label: "ask thomas" },
        { label: "C" },
        { label: "D" },
        { label: "E" },
      ],
    });
    expect(options.map((o) => o.label)).toEqual([
      "Hold",
      "Ask Thomas",
      "C",
      "D",
    ]);
    expect(options[0]).toEqual({
      label: "Hold",
      description: "Park it",
      recommended: true,
    });
  });
  it("is empty when the asker offered none", () => {
    expect(askOptions({ kind: "question" })).toEqual([]);
  });
});

describe("askKey", () => {
  it("keys a task by its ref and a Commander ask by its id", () => {
    expect(askKey({ kind: "task", ref: "db:1" })).toBe("db:1");
    expect(askKey({ kind: "commander", id: "dash-1" })).toBe(
      "ask:commander:dash-1",
    );
    expect(askKey({ kind: "question" })).toBeNull();
  });
});

import { answerOptions, YES_NO_OPTIONS } from "../src/sidebar/waiting/model";

describe("answerOptions", () => {
  it("offers yes and no, once or always, for a closed question without options", () => {
    const options = answerOptions(
      { kind: "question" },
      "Restart the Dashboard waiter?",
    );
    expect(options.map((o) => o.label)).toEqual([
      "Yes, and for all future requests",
      "Yes, once",
      "No, and for all future requests",
      "No, once",
    ]);
    expect(options.filter((o) => o.always).length).toBe(2);
  });
  it("offers none for an open question or a statement", () => {
    expect(
      answerOptions({ kind: "question" }, "Which client gets Friday?"),
    ).toEqual([]);
    expect(answerOptions({ kind: "task" }, "Name the support system")).toEqual(
      [],
    );
  });
  it("keeps the asker's own options", () => {
    expect(
      answerOptions(
        { kind: "commander", options: [{ label: "Hold" }] },
        "Go?",
      ).map((o) => o.label),
    ).toEqual(["Hold"]);
    expect(YES_NO_OPTIONS.length).toBe(4);
  });
});

import { answeredView } from "../src/sidebar/waiting/model";

describe("answeredView", () => {
  const now = new Date("2026-11-02T14:10:00Z");
  it("shows an ask with no answer, or one that failed to send", () => {
    expect(answeredView(null, now)).toBe("show");
    expect(
      answeredView(
        { state: "failed", requestedAt: "2026-11-02T14:05:00Z" },
        now,
      ),
    ).toBe("show");
  });
  it("hides it for ten minutes after an answer, then marks it late", () => {
    expect(
      answeredView(
        { state: "received", requestedAt: "2026-11-02T14:05:00Z" },
        now,
      ),
    ).toBe("hide");
    expect(
      answeredView(
        { state: "received", requestedAt: "2026-11-02T13:59:00Z" },
        now,
      ),
    ).toBe("late");
  });
});

import { askText } from "../src/sidebar/waiting/model";

describe("askText with a possessive", () => {
  it("turns the operator's go into your go", () => {
    expect(
      askText(
        { kind: "task", ask: "Tobias's go to import the three tickets" },
        "Tobias",
      ).ask,
    ).toBe("Your go to import the three tickets");
    expect(
      askText({ kind: "task", ask: "Tobias’s go to merge" }, "Tobias").ask,
    ).toBe("Your go to merge");
    expect(
      askText({ kind: "task", ask: "your approval for the window" }, "Tobias")
        .ask,
    ).toBe("Your approval for the window");
    expect(
      askText({ kind: "task", ask: "Tobias: approve the budget" }, "Tobias")
        .ask,
    ).toBe("Approve the budget");
  });
  it("offers yes or no for a go-ahead without a question mark", () => {
    expect(
      answerOptions({ kind: "task" }, "Your go to import the three tickets")
        .length,
    ).toBe(4);
    expect(
      answerOptions({ kind: "task" }, "OK to restart staging").length,
    ).toBe(4);
    expect(
      answerOptions({ kind: "task" }, "Name the support system").length,
    ).toBe(0);
  });
});
