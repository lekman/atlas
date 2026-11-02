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
