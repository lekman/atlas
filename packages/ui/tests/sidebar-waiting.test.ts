import { describe, expect, it } from "bun:test";

import {
  askText,
  failedSources,
  isWaitingDoc,
  waitingSource,
} from "../src/sidebar";

describe("askText", () => {
  it("drops the operator's name from a task's waitingFor", () => {
    expect(
      askText({ kind: "task", ask: "Alex: approve the budget" }, "Alex"),
    ).toEqual({
      ask: "Approve the budget",
      tooltip: "",
    });
    expect(
      askText({ kind: "task", ask: "you – sign the NDA" }, "Alex").ask,
    ).toBe("Sign the NDA");
  });

  it("keeps what a Commander summary asks, and the summary as the tooltip", () => {
    const raw = "Tests green; Alex to merge #12";
    expect(askText({ kind: "commander", ask: raw }, "Alex")).toEqual({
      ask: "Merge #12",
      tooltip: raw,
    });
  });

  it("prefers the item's own reason as the tooltip", () => {
    expect(
      askText(
        { kind: "commander", ask: "Alex: pick a date", reason: "Planning" },
        "Alex",
      ).tooltip,
    ).toBe("Planning");
  });

  it("treats the name as text, not a pattern", () => {
    expect(askText({ kind: "task", ask: "A.x: go" }, "A.x").ask).toBe("Go");
    expect(askText({ kind: "task", ask: "Abx: go" }, "A.x").ask).toBe(
      "Abx: go",
    );
  });
});

describe("waitingSource", () => {
  it("names the client, the task and the day for a task", () => {
    expect(
      waitingSource(
        { kind: "task", title: "Scanners", since: "2026-03-10T09:00:00" },
        "Kestrel Freight",
      ),
    ).toEqual(["Kestrel Freight", "Scanners", "since Tue 10 Mar"]);
  });

  it("names Commander for its requests and questions", () => {
    expect(waitingSource({ kind: "commander", worker: "Ops" }, "x")).toEqual([
      "Commander · Ops",
    ]);
    expect(waitingSource({ kind: "commander" }, "x")).toEqual([
      "Commander · worker",
    ]);
    expect(waitingSource({ kind: "question" }, "x")).toEqual([
      "Commander asks",
    ]);
  });
});

describe("isWaitingDoc", () => {
  it("accepts the answer and the stored copy", () => {
    expect(isWaitingDoc({ items: [], storedAt: "x" })).toBe(true);
    expect(isWaitingDoc({ hosts: [] })).toBe(false);
  });
});

describe("failedSources", () => {
  it("names each failed source once", () => {
    expect(
      failedSources(["acme: down", "questions: refused", "acme: again"]),
    ).toEqual(["acme", "questions"]);
    expect(failedSources(undefined)).toEqual([]);
  });
});
