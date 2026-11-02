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
