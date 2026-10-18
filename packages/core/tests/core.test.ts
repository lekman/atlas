import { describe, expect, it } from "bun:test";

import {
  applyEvent,
  AtlasEvent,
  Dataset,
  exportCard,
  findBrokenReferences,
  findPersonalData,
  homeOf,
  mayHold,
  needsYou,
  type BoundaryPolicy,
  type CardRequest,
} from "../src";

const governed = {
  classification: "internal",
  boundary: "home-server",
} as const;

function sample(): Dataset {
  return Dataset.parse({
    clients: [
      { id: "home", name: "Home Office", home: true, ...governed },
      { id: "acme", name: "Acme", ...governed },
    ],
    accounts: [
      { id: "claude-work", label: "Claude · work", runtime: "claude" },
    ],
    groups: [
      { id: "acme-crew", clientId: "acme", name: "Acme crew", ...governed },
      { id: "home-crew", clientId: "home", name: "Upkeep", ...governed },
    ],
    agents: [
      {
        id: "release",
        groupId: "acme-crew",
        name: "Release",
        accountId: "claude-work",
        host: "Mac mini",
        reach: "remote-control",
        status: "running",
        workingOn: ["cut-over"],
        note: "Rehearsing",
        ...governed,
      },
      {
        id: "sync",
        groupId: "home-crew",
        name: "Sync",
        accountId: "claude-work",
        host: "Mac mini",
        reach: "local",
        status: "blocked",
        workingOn: [],
        note: "Calendar feed returns 401",
        ...governed,
      },
    ],
    requirements: [
      {
        id: "one-tenant",
        clientId: "acme",
        title: "One tenant",
        state: "open",
        ...governed,
      },
    ],
    items: [
      {
        id: "cut-over",
        clientId: "acme",
        requirementId: "one-tenant",
        title: "Rehearse the cut-over",
        state: "doing",
        priority: "high",
        ...governed,
      },
    ],
    questions: [
      {
        id: "alarms",
        clientId: "acme",
        title: "Alarms live at go-live?",
        blocks: "cut-over",
        asks: "You",
        state: "open",
        ...governed,
      },
    ],
    decisions: [],
  });
}

describe("dataset", () => {
  it("parses and has no broken references", () => {
    expect(findBrokenReferences(sample())).toEqual([]);
  });

  it("finds the home client", () => {
    expect(homeOf(sample()).id).toBe("home");
  });

  it("reports a reference to a record that does not exist", () => {
    const broken = sample();
    broken.items[0] = { ...broken.items[0]!, requirementId: "missing" };
    expect(findBrokenReferences(broken)).toContain(
      "cut-over.requirementId names unknown missing",
    );
  });

  it("requires exactly one home", () => {
    const twoHomes = sample();
    twoHomes.clients[1] = { ...twoHomes.clients[1]!, home: true };
    expect(findBrokenReferences(twoHomes)).toContain(
      "expected exactly one home client, found 2",
    );
  });

  it("rejects an identifier with capitals or spaces", () => {
    const bad = {
      ...sample(),
      clients: [{ id: "Acme Ltd", name: "x", ...governed }],
    };
    expect(Dataset.safeParse(bad).success).toBe(false);
  });
});

describe("needs you", () => {
  it("lists your questions before agents that need attention", () => {
    const entries = needsYou(sample());
    expect(entries.map((entry) => entry.id)).toEqual(["alarms", "sync"]);
    expect(entries[0]?.detail).toBe("Blocks Rehearse the cut-over");
    expect(entries[1]?.clientId).toBe("home");
  });
});

describe("events", () => {
  it("changes an agent's status and note", () => {
    const next = applyEvent(sample(), {
      type: "status-change",
      agentId: "release",
      to: "waiting",
      text: "Needs a window",
    });
    expect(next.agents[0]?.status).toBe("waiting");
    expect(next.agents[0]?.note).toBe("Needs a window");
  });

  it("turns an answered question into a linked decision", () => {
    const next = applyEvent(sample(), {
      type: "question-answered",
      questionId: "alarms",
      answer: "Yes, severity alarms are live",
      decision: {
        id: "alarms-live",
        clientId: "acme",
        title: "Severity alarms live at go-live",
        decides: "cut-over",
        state: "made",
        ...governed,
      },
    });
    expect(next.questions[0]?.state).toBe("answered");
    expect(next.decisions[0]?.fromQuestion).toBe("alarms");
    expect(needsYou(next).map((entry) => entry.id)).toEqual(["sync"]);
  });

  it("does not answer the same question twice", () => {
    const answered = applyEvent(sample(), {
      type: "question-answered",
      questionId: "alarms",
      answer: "Yes",
      decision: {
        id: "d1",
        clientId: "acme",
        title: "Yes",
        state: "made",
        ...governed,
      },
    });
    const again = applyEvent(answered, {
      type: "question-answered",
      questionId: "alarms",
      answer: "No",
      decision: {
        id: "d2",
        clientId: "acme",
        title: "No",
        state: "made",
        ...governed,
      },
    });
    expect(again.decisions).toHaveLength(1);
  });

  it("leaves the dataset unchanged for messages and external events", () => {
    const before = sample();
    expect(
      applyEvent(before, {
        type: "agent-message",
        from: "release",
        to: "sync",
        text: "hi",
      }),
    ).toBe(before);
  });

  it("validates an event from outside", () => {
    expect(
      AtlasEvent.safeParse({
        type: "external",
        source: "github",
        recordId: "cut-over",
        text: "PR merged",
      }).success,
    ).toBe(true);
    expect(
      AtlasEvent.safeParse({
        type: "external",
        source: "fax",
        recordId: "cut-over",
        text: "x",
      }).success,
    ).toBe(false);
  });
});

describe("boundaries", () => {
  const home: BoundaryPolicy = {
    id: "home-server",
    name: "Mac mini",
    clearance: "client-confidential",
  };
  const request: CardRequest = {
    id: "mail-1",
    kind: "question",
    clientId: "acme",
    title: "Which build runs in the pilot?",
    state: "open",
    classification: "client-confidential",
    sourceBoundary: "client-laptop",
    sourceReference: "ref-7f3a",
  };

  it("lets a boundary hold up to its clearance", () => {
    expect(mayHold(home, "client-confidential")).toBe(true);
    expect(mayHold(home, "restricted")).toBe(false);
  });

  it("exports a card with only the allowed fields", () => {
    const card = exportCard(request, home);
    expect(card).toEqual(request);
  });

  it("withholds a restricted record, title and all", () => {
    expect(
      exportCard({ ...request, classification: "restricted" }, home),
    ).toEqual({
      withheld: true,
      clientId: "acme",
      sourceBoundary: "client-laptop",
    });
  });

  it("refuses a title that still holds personal data", () => {
    expect(() =>
      exportCard({ ...request, title: "Reply to jane.doe@acme.example" }, home),
    ).toThrow(/contains email/);
  });

  it("refuses extra fields on a card", () => {
    expect(() =>
      exportCard({ ...request, body: "the whole email" } as CardRequest, home),
    ).toThrow();
  });
});

describe("personal data finder", () => {
  it("finds the obvious kinds", () => {
    const kinds = (text: string) =>
      findPersonalData(text).map((finding) => finding.kind);
    expect(kinds("mail jane@example.com")).toEqual(["email"]);
    expect(kinds("call +46 70 123 45 67")).toEqual(["phone"]);
    expect(kinds("subject 19850412345")).toContain("long-number");
    expect(kinds("see https://example.com/case?id=42")).toEqual([
      "url-with-query",
    ]);
  });

  it("leaves ordinary titles alone", () => {
    expect(
      findPersonalData("Rehearse the cut-over on Saturday at 10:00"),
    ).toEqual([]);
    expect(findPersonalData("PR #366 checks passed")).toEqual([]);
  });
});
