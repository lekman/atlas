import { beforeEach, describe, expect, test } from "bun:test";

import type { AgentDispatchEvent, AtlasEvent, Dataset } from "@atlas/core";
import { sampleDataset } from "@atlas/fixtures";

import {
  agentWorkOf,
  createApi,
  createIdleWatcher,
  decideNudge,
  defaultDispatcherSettings,
  durationText,
  findIdleWithWork,
  openDatabase,
  parseDispatcherFile,
  seedDataset,
  type AgentSessionState,
  type AgentWaker,
  type AgentWork,
  type AtlasDatabase,
  type IdleWithWorkSettings,
  type RuleMode,
  type WakeRequest,
} from "../src";
import * as schema from "../src/schema";

const now = new Date("2026-11-09T12:00:00.000Z");
const settings: IdleWithWorkSettings = {
  idleMinutes: 20,
  goneMinutes: 10,
  cooldownMinutes: 60,
};
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000).toISOString();

const webhooks = {
  id: "webhooks",
  title: "Partner webhooks",
  state: "doing",
  blocked: false,
  clientId: "kestrel",
} as const;
const rateLimits = {
  id: "rate-limits",
  title: "Rate limits per partner",
  state: "todo",
  blocked: false,
  clientId: "kestrel",
} as const;

function work(
  session: AgentSessionState | undefined,
  tasks: AgentWork["tasks"] = [webhooks, rateLimits],
): AgentWork {
  return {
    agentId: "tracking",
    agentName: "Tracking",
    clientId: "kestrel",
    ...(session ? { session } : {}),
    tasks,
  };
}

describe("finding agents idle with open work", () => {
  test("flags an idle session past the threshold, with the task and how long", () => {
    const [found] = findIdleWithWork(
      [work({ state: "idle", since: minutesAgo(34) })],
      settings,
      now,
    );
    expect(found).toEqual({
      kind: "idle",
      agentId: "tracking",
      agentName: "Tracking",
      clientId: "kestrel",
      session: "idle",
      since: minutesAgo(34),
      minutes: 34,
      tasks: [webhooks, rateLimits],
      signalKey: `atlas:idle-with-work:tracking:${minutesAgo(34)}`,
      note: "Idle 34 min with 2 open tasks",
      reason: "Holds Partner webhooks (doing) and 1 more; session idle 34 min",
    });
  });

  test("flags a session gone past its own, shorter threshold", () => {
    const [found] = findIdleWithWork(
      [work({ state: "offline", since: minutesAgo(12) }, [rateLimits])],
      settings,
      now,
    );
    expect(found).toMatchObject({
      kind: "idle",
      session: "gone",
      minutes: 12,
      note: "No session for 12 min with 1 open task",
      reason: "Holds Rate limits per partner (todo); no session for 12 min",
    });
  });

  test("leaves an agent alone below either threshold", () => {
    expect(
      findIdleWithWork(
        [
          work({ state: "idle", since: minutesAgo(20) }),
          work({ state: "offline", since: minutesAgo(9) }),
        ],
        settings,
        now,
      ),
    ).toEqual([]);
  });

  test("leaves a busy or waiting session alone, however long it has been in that state", () => {
    expect(
      findIdleWithWork(
        [
          work({ state: "busy", since: minutesAgo(300) }),
          work({ state: "waiting", since: minutesAgo(300) }),
        ],
        settings,
        now,
      ),
    ).toEqual([]);
  });

  test("leaves an agent alone when every task it holds is blocked, in review or done", () => {
    expect(
      findIdleWithWork(
        [
          work({ state: "idle", since: minutesAgo(60) }, [
            { ...webhooks, blocked: true },
            { ...rateLimits, state: "review" },
            { ...rateLimits, id: "done-one", state: "done" },
          ]),
          work({ state: "idle", since: minutesAgo(60) }, []),
        ],
        settings,
        now,
      ),
    ).toEqual([]);
  });

  test("counts only the open tasks among those it holds", () => {
    const [found] = findIdleWithWork(
      [
        work({ state: "idle", since: minutesAgo(25) }, [
          { ...webhooks, blocked: true },
          rateLimits,
        ]),
      ],
      settings,
      now,
    );
    expect(found?.tasks).toEqual([rateLimits]);
    expect(found?.note).toBe("Idle 25 min with 1 open task");
  });

  test("does not judge an agent whose session this machine has never seen", () => {
    expect(findIdleWithWork([work(undefined)], settings, now)).toEqual([]);
  });

  test("gives a limited session a note instead of a signal", () => {
    expect(
      findIdleWithWork(
        [work({ state: "limited", since: minutesAgo(90) })],
        settings,
        now,
      ),
    ).toEqual([
      {
        kind: "limited",
        agentId: "tracking",
        tasks: [webhooks, rateLimits],
        note: "2 open tasks wait for the reset",
      },
    ]);
  });

  test("writes long spells in hours and minutes", () => {
    expect(durationText(34)).toBe("34 min");
    expect(durationText(60)).toBe("1 h");
    expect(durationText(125)).toBe("2 h 5 min");
  });

  test("defaults to 20 minutes idle, 10 minutes gone, a 60-minute cool-down, and a dry rule", () => {
    expect(defaultDispatcherSettings.idleWithWork).toEqual(settings);
    expect(defaultDispatcherSettings.rules["nudge-idle-with-work"]).toBe("dry");
  });
});

describe("joining agents to their sessions and claimed tasks", () => {
  test("takes each agent's claimed items, its client, and its session; leaves vessels out", () => {
    const sessions = new Map<string, AgentSessionState>([
      ["tracking", { state: "idle", since: minutesAgo(30) }],
    ]);
    const vessel = {
      ...sampleDataset.agents.find((agent) => agent.id === "tracking")!,
      id: "tracking-vessel",
      parentId: "tracking",
    };
    const all = agentWorkOf(
      { ...sampleDataset, agents: [...sampleDataset.agents, vessel] },
      sessions,
    );
    expect(all.some((entry) => entry.agentId === "tracking-vessel")).toBe(
      false,
    );
    expect(all.find((entry) => entry.agentId === "tracking")).toEqual({
      agentId: "tracking",
      agentName: "Tracking",
      clientId: "kestrel",
      session: { state: "idle", since: minutesAgo(30) },
      tasks: [webhooks, rateLimits],
    });
    expect(all.find((entry) => entry.agentId === "schema")?.session).toBe(
      undefined,
    );
  });
});

describe("the nudge rule", () => {
  const idle = {
    agentName: "Tracking",
    session: "idle" as const,
    tasks: [webhooks, rateLimits],
    minutes: 34,
  };

  test("decides nothing while off", () => {
    expect(
      decideNudge(idle, { mode: "off", lastNudgedAt: null, now }, settings),
    ).toBeUndefined();
  });

  test("wakes an idle session with a fixed message naming the first task", () => {
    expect(
      decideNudge(idle, { mode: "on", lastNudgedAt: null, now }, settings),
    ).toEqual({
      outcome: "wake",
      mode: "on",
      needsYou: false,
      task: webhooks,
      message:
        "Continue Partner webhooks: your session has been idle with it open",
      text: "Wake the session to continue Partner webhooks",
    });
    expect(
      decideNudge(idle, { mode: "dry", lastNudgedAt: null, now }, settings)
        ?.text,
    ).toBe("Would wake the session to continue Partner webhooks");
  });

  test("asks you to restart a gone session with cc-restart, and never restarts it", () => {
    const gone = { ...idle, session: "gone" as const };
    expect(
      decideNudge(gone, { mode: "on", lastNudgedAt: null, now }, settings),
    ).toEqual({
      outcome: "ask",
      mode: "on",
      needsYou: true,
      command: "cc-restart Tracking",
      text: "Needs a restart to continue Partner webhooks: cc-restart Tracking",
    });
    expect(
      decideNudge(gone, { mode: "dry", lastNudgedAt: null, now }, settings),
    ).toMatchObject({
      needsYou: false,
      text: "Would ask you for a restart: cc-restart Tracking",
    });
  });

  test("nudges an agent at most once per cool-down", () => {
    expect(
      decideNudge(
        idle,
        { mode: "on", lastNudgedAt: minutesAgo(59), now },
        settings,
      ),
    ).toBeUndefined();
    expect(
      decideNudge(
        idle,
        { mode: "on", lastNudgedAt: minutesAgo(60), now },
        settings,
      )?.outcome,
    ).toBe("wake");
  });

  test("reads its mode and thresholds from the dispatcher file, keeping defaults for the rest", () => {
    const read = parseDispatcherFile(
      JSON.stringify({
        rules: { "nudge-idle-with-work": "on" },
        idleWithWork: { idleMinutes: 30 },
      }),
    );
    expect(read.settings.rules["nudge-idle-with-work"]).toBe("on");
    expect(read.settings.rules["merge-approved"]).toBe("dry");
    expect(read.settings.idleWithWork).toEqual({
      idleMinutes: 30,
      goneMinutes: 10,
      cooldownMinutes: 60,
    });
    expect(() =>
      parseDispatcherFile(JSON.stringify({ idleWithWork: { idleMinutes: 0 } })),
    ).toThrow("idleWithWork.idleMinutes");
  });
});

describe("the idle watcher", () => {
  let database: AtlasDatabase;
  let recorded: AtlasEvent[];
  let clock: Date;
  let states: Map<string, AgentSessionState> | undefined;
  let woken: WakeRequest[];
  let dataset: Dataset;

  const waker: AgentWaker = {
    async wake(request) {
      woken.push(request);
    },
  };

  function watcher(mode: RuleMode = "dry", withWaker = true) {
    const made = createIdleWatcher({
      database,
      sessions: { agentSessions: () => states },
      settings,
      mode,
      ...(withWaker ? { waker } : {}),
      now: () => clock,
      log: () => {},
    });
    made.connect({
      dataset: () => dataset,
      record: (event) => recorded.push(event),
    });
    return made;
  }

  async function check(made: ReturnType<typeof watcher>) {
    made.check();
    await made.settled();
  }

  const signals = () =>
    recorded.filter(
      (event) => event.type === "signal" && event.kind === "agent",
    );
  const decisions = () =>
    recorded.filter(
      (event): event is AgentDispatchEvent =>
        event.type === "dispatch" && event.rule === "nudge-idle-with-work",
    );

  beforeEach(() => {
    database = openDatabase(":memory:");
    recorded = [];
    woken = [];
    clock = now;
    dataset = sampleDataset;
    states = new Map([["tracking", { state: "idle", since: minutesAgo(34) }]]);
  });

  test("records one signal per spell, with the agent, the tasks and the minutes", async () => {
    const made = watcher("off");
    await check(made);
    await check(made);
    expect(signals()).toEqual([
      {
        type: "signal",
        source: "atlas",
        key: `atlas:idle-with-work:tracking:${minutesAgo(34)}`,
        kind: "agent",
        event: "idle_with_work",
        agentId: "tracking",
        session: "idle",
        minutes: 34,
        taskIds: ["webhooks", "rate-limits"],
        client: "kestrel",
        recordIds: ["tracking", "webhooks", "rate-limits"],
        at: now.toISOString(),
        text: "Idle 34 min with 2 open tasks",
      },
    ]);
    expect(decisions()).toEqual([]);
  });

  test("clears the signal, with the same key, once the agent works again", async () => {
    const made = watcher("off");
    await check(made);
    states = new Map([
      ["tracking", { state: "busy", since: now.toISOString() }],
    ]);
    await check(made);
    expect(signals().at(-1)).toMatchObject({
      event: "cleared",
      key: `atlas:idle-with-work:tracking:${minutesAgo(34)}`,
      agentId: "tracking",
      taskIds: ["webhooks", "rate-limits"],
      text: "Working again",
    });
    await check(made);
    expect(signals()).toHaveLength(2);
  });

  test("clears the signal after a restart of Atlas, from the stored spell", async () => {
    await check(watcher("off"));
    states = new Map([
      ["tracking", { state: "busy", since: now.toISOString() }],
    ]);
    await check(watcher("off"));
    expect(
      signals().map((event) => event.type === "signal" && event.event),
    ).toEqual(["idle_with_work", "cleared"]);
  });

  test("does nothing before the session reader has a good read", async () => {
    states = undefined;
    await check(watcher("on"));
    expect(recorded).toEqual([]);
  });

  test("lays the note over the agent and lists it on the digest", async () => {
    const made = watcher("off");
    let refreshes = 0;
    made.subscribe(() => refreshes++);
    await check(made);
    expect(refreshes).toBe(1);
    clock = new Date(now.getTime() + 5 * 60_000);
    const agent = made
      .overlay(sampleDataset)
      .agents.find((each) => each.id === "tracking");
    expect(agent?.note).toBe("Idle 39 min with 2 open tasks");
    expect(made.digest()).toEqual([
      {
        kind: "idle-with-work",
        agentId: "tracking",
        agentName: "Tracking",
        session: "idle",
        since: minutesAgo(34),
        minutes: 34,
        taskIds: ["webhooks", "rate-limits"],
        text: "Holds Partner webhooks (doing) and 1 more; session idle 34 min",
      },
    ]);
  });

  test("adds the open tasks to a limited agent's note, and records no signal", async () => {
    states = new Map([
      ["tracking", { state: "limited", since: minutesAgo(90) }],
    ]);
    const made = watcher("on");
    await check(made);
    expect(recorded).toEqual([]);
    const limited = {
      ...sampleDataset,
      agents: sampleDataset.agents.map((each) =>
        each.id === "tracking"
          ? { ...each, note: "Weekly usage limit reached, resets 25 Oct 18:00" }
          : each,
      ),
    };
    expect(
      made.overlay(limited).agents.find((each) => each.id === "tracking")?.note,
    ).toBe(
      "Weekly usage limit reached, resets 25 Oct 18:00. 2 open tasks wait for the reset",
    );
    expect(made.digest()).toEqual([]);
  });

  test("in dry mode records the wake without waking, then waits out the cool-down", async () => {
    const made = watcher("dry");
    await check(made);
    clock = new Date(now.getTime() + 30 * 60_000);
    await check(made);
    expect(woken).toEqual([]);
    expect(decisions()).toEqual([
      {
        type: "dispatch",
        signalKey: `atlas:idle-with-work:tracking:${minutesAgo(34)}`,
        rule: "nudge-idle-with-work",
        mode: "dry",
        outcome: "wake",
        agentId: "tracking",
        taskIds: ["webhooks", "rate-limits"],
        client: "kestrel",
        needsYou: false,
        text: "Would wake the session to continue Partner webhooks",
      },
    ]);
    clock = new Date(now.getTime() + 61 * 60_000);
    await check(made);
    expect(decisions()).toHaveLength(2);
  });

  test("in on mode wakes the session through Commander, naming the task", async () => {
    await check(watcher("on"));
    expect(woken).toEqual([
      {
        requestId: expect.stringMatching(/^dash-atlas-[0-9a-f]{32}$/),
        taskId: "webhooks",
        clientName: "Kestrel Freight",
        title:
          "Continue Partner webhooks: your session has been idle with it open",
        url: null,
        key: null,
        day: "2026-11-09",
      },
    ]);
    expect(decisions()[0]).toMatchObject({
      mode: "on",
      outcome: "wake",
      woken: true,
      text: "Woke the session to continue Partner webhooks",
    });
  });

  test("keeps the cool-down across a restart of Atlas", async () => {
    await check(watcher("on"));
    clock = new Date(now.getTime() + 10 * 60_000);
    await check(watcher("on"));
    expect(woken).toHaveLength(1);
    expect(database.select().from(schema.idleWithWork).all()[0]?.nudgedAt).toBe(
      now.toISOString(),
    );
  });

  test("records a wake as dry without a waker, and a failed wake as a failure", async () => {
    await check(watcher("on", false));
    expect(decisions()[0]).toMatchObject({
      mode: "dry",
      outcome: "wake",
      woken: false,
      text: "Would wake the session to continue Partner webhooks: no waker is configured",
    });
    database = openDatabase(":memory:");
    recorded = [];
    const failing = createIdleWatcher({
      database,
      sessions: { agentSessions: () => states },
      settings,
      mode: "on",
      waker: {
        async wake() {
          throw new Error("Commander answered HTTP 503");
        },
      },
      now: () => clock,
      log: () => {},
    });
    failing.connect({
      dataset: () => dataset,
      record: (event) => recorded.push(event),
    });
    await check(failing);
    expect(decisions()[0]).toMatchObject({
      outcome: "fail",
      woken: false,
      text: "Could not wake the session: Commander answered HTTP 503",
    });
  });

  test("asks you to restart a gone session in on mode, and never wakes it", async () => {
    states = new Map([
      ["tracking", { state: "offline", since: minutesAgo(15) }],
    ]);
    await check(watcher("on"));
    expect(woken).toEqual([]);
    expect(decisions()).toEqual([
      expect.objectContaining({
        outcome: "ask",
        mode: "on",
        needsYou: true,
        command: "cc-restart Tracking",
        text: "Needs a restart to continue Partner webhooks: cc-restart Tracking",
      }),
    ]);
  });

  test("serves the note on the dataset and the agent on the digest through the API", async () => {
    seedDataset(database, sampleDataset);
    const made = watcher("off");
    const api = createApi({ database, version: "0.0.0-test", idle: made });
    await check(made);
    const read = async (path: string) =>
      (await api.handle(new Request(`http://atlas.test${path}`)))?.json();
    const served = (await read("/api/dataset")) as Dataset;
    expect(served.agents.find((each) => each.id === "tracking")?.note).toBe(
      "Idle 34 min with 2 open tasks",
    );
    expect(await read("/api/digest")).toEqual([
      expect.objectContaining({ kind: "idle-with-work", agentId: "tracking" }),
    ]);
    // The signal went through the API's record path, so it is in the log.
    const logged = (await read("/api/events")) as { event: AtlasEvent }[];
    expect(
      logged.some(
        (stored) =>
          stored.event.type === "signal" && stored.event.kind === "agent",
      ),
    ).toBe(true);
    api.close();
  });
});
