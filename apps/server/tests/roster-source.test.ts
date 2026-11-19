import { sampleDataset } from "@atlas/fixtures";
import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createRosterSource,
  openDatabase,
  readDataset,
  rosterId,
  seedDataset,
  syncRoster,
  type AtlasDatabase,
  type Roster,
  type RosterMachines,
} from "../src";

const roster: Roster = {
  commander: "Lead",
  machine: "server",
  agents: [
    {
      name: "Ops Desk",
      client: "Kestrel Freight",
      machine: "server",
      owns: ["the ops desk"],
    },
    { name: "Field Laptop", client: "Halcyon Labs", machine: "macbook" },
    { name: "Nobody's", client: "Unknown Client", machine: "server" },
  ],
};

const machines: RosterMachines = {
  server: { host: "Mac mini", account: "claude-work", reach: "ssh" },
  macbook: { host: "MacBook", reach: "local" },
};

describe("syncRoster", () => {
  let database: AtlasDatabase;
  beforeEach(() => {
    database = openDatabase(":memory:");
    seedDataset(database, sampleDataset);
  });

  const agent = (id: string) =>
    readDataset(database).agents.find((a) => a.id === id);

  test("adds the roster agents Atlas lacks, in their client's group", () => {
    const result = syncRoster(database, roster, machines, "raw-host.local");
    expect(result.added).toEqual(["lead", "ops-desk", "field-laptop"]);
    expect(result.skipped).toEqual(["Nobody's"]);
    const desk = agent("ops-desk");
    expect(desk?.groupId).toBe("partner-api");
    expect(desk?.host).toBe("Mac mini");
    expect(desk?.reach).toBe("ssh");
    expect(desk?.note).toBe("the ops desk");
    expect(desk?.status).toBe("idle");
    expect(agent("field-laptop")?.host).toBe("MacBook");
    expect(agent("lead")?.groupId).toBe("upkeep");
  });

  test("updates an agent's mapping but never its status or work", () => {
    syncRoster(database, roster, machines, "raw-host.local");
    database.$client.run(
      "UPDATE agents SET status = 'running', working_on = '[\"x\"]', host = 'Old' WHERE id = 'ops-desk'",
    );
    const result = syncRoster(database, roster, machines, "raw-host.local");
    expect(result.added).toEqual([]);
    expect(result.updated).toEqual(["ops-desk"]);
    const desk = agent("ops-desk");
    expect(desk?.host).toBe("Mac mini");
    expect(desk?.status).toBe("running");
    expect(desk?.workingOn).toEqual(["x"]);
  });

  test("changes nothing on a second read of the same roster", () => {
    syncRoster(database, roster, machines, "raw-host.local");
    const again = syncRoster(database, roster, machines, "raw-host.local");
    expect([again.added, again.updated, again.rehosted]).toEqual([[], [], 0]);
  });

  test("gives agents on this machine's raw host name the roster's name for it", () => {
    syncRoster(database, roster, machines, "raw-host.local");
    database.$client.run(
      "UPDATE agents SET host = 'raw-host.local' WHERE id = 'field-laptop'",
    );
    // A docked agent is not in the roster, so only the rehost touches it.
    const docked = readDataset(database).agents.find(
      (a) => !["lead", "ops-desk", "field-laptop"].includes(a.id),
    )!;
    database.$client.run(
      `UPDATE agents SET host = 'raw-host.local' WHERE id = '${docked.id}'`,
    );
    const result = syncRoster(database, roster, machines, "raw-host.local");
    expect(result.rehosted).toBeGreaterThanOrEqual(1);
    expect(agent(docked.id)?.host).toBe("Mac mini");
  });

  test("without a machines file, a host is the machine's own name", () => {
    syncRoster(database, roster, {}, "raw-host.local");
    expect(agent("ops-desk")?.host).toBe("server");
    expect(agent("ops-desk")?.reach).toBe("none");
  });

  test("ids follow the seed's slugs", () => {
    expect(rosterId("Ops Portal")).toBe("ops-portal");
    expect(rosterId("DevSecOps")).toBe("devsecops");
    expect(rosterId("AI Productivity")).toBe("ai-productivity");
  });
});

describe("createRosterSource", () => {
  test("reads the file, tells listeners once, and skips an unchanged file", () => {
    const database = openDatabase(":memory:");
    seedDataset(database, sampleDataset);
    const dir = mkdtempSync(join(tmpdir(), "roster-"));
    const path = join(dir, "commander.json");
    writeFileSync(path, JSON.stringify(roster));
    const source = createRosterSource({
      path,
      machines,
      database,
      log: () => {},
    });
    let changes = 0;
    source.subscribe(() => changes++);
    source.poll();
    source.poll();
    expect(changes).toBe(1);
    expect(source.health().ok).toBe(true);
    expect(source.hostName()).toBe("Mac mini");
  });

  test("says so when the file is not a roster", () => {
    const database = openDatabase(":memory:");
    seedDataset(database, sampleDataset);
    const dir = mkdtempSync(join(tmpdir(), "roster-"));
    const path = join(dir, "commander.json");
    writeFileSync(path, '{"agents": 3}');
    const source = createRosterSource({
      path,
      machines,
      database,
      log: () => {},
    });
    source.poll();
    expect(source.health().ok).toBe(false);
  });
});
