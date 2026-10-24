import { sampleDataset } from "@atlas/fixtures";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { beforeEach, describe, expect, test } from "bun:test";

import {
  callerAddress,
  canSee,
  createApi,
  everyClient,
  hashToken,
  identify,
  issueMachineToken,
  listMachines,
  machineForToken,
  openDatabase,
  revokeMachine,
  seedDataset,
  type AtlasDatabase,
  type NodeLookup,
} from "../src";

/** Two machines on the test tailnet, and a stranger with no node. */
const nodes: Record<string, string> = {
  "100.64.0.1": "node-laptop",
  "100.64.0.2": "node-mini",
};
const lookupNode: NodeLookup = async (address) => nodes[address];

let database: AtlasDatabase;

beforeEach(() => {
  database = openDatabase(":memory:");
  seedDataset(database, sampleDataset);
});

const request = (headers: Record<string, string> = {}, path = "/api/dataset") =>
  new Request(`http://atlas.test${path}`, { headers });

describe("machine tokens", () => {
  test("are stored only as a hash and found again by the token", () => {
    const token = issueMachineToken(database, {
      id: "laptop",
      nodeStableId: "node-laptop",
      clients: ["halcyon"],
    });
    expect(token).toStartWith("atlas_");
    const stored = database.$client
      .query("select token_hash from machines where id = 'laptop'")
      .get() as { token_hash: string };
    expect(stored.token_hash).toBe(hashToken(token));
    expect(stored.token_hash).not.toContain(token);
    expect(machineForToken(database, token)?.id).toBe("laptop");
    expect(machineForToken(database, "atlas_wrong")).toBeUndefined();
    expect(machineForToken(database, "not-a-token")).toBeUndefined();
  });

  test("issuing again replaces the token, and revoking ends it", () => {
    const first = issueMachineToken(database, {
      id: "laptop",
      nodeStableId: "node-laptop",
      clients: [everyClient],
    });
    const second = issueMachineToken(database, {
      id: "laptop",
      nodeStableId: "node-laptop",
      clients: [everyClient],
    });
    expect(machineForToken(database, first)).toBeUndefined();
    expect(machineForToken(database, second)?.id).toBe("laptop");
    expect(listMachines(database)).toHaveLength(1);
    expect(revokeMachine(database, "laptop")).toBe(true);
    expect(machineForToken(database, second)).toBeUndefined();
    expect(revokeMachine(database, "nobody")).toBe(false);
  });

  test("refuse an id that is not an identifier, or an empty scope", () => {
    expect(() =>
      issueMachineToken(database, {
        id: "My Laptop",
        nodeStableId: "node-laptop",
        clients: ["*"],
      }),
    ).toThrow();
    expect(() =>
      issueMachineToken(database, {
        id: "laptop",
        nodeStableId: "node-laptop",
        clients: [],
      }),
    ).toThrow("name the clients");
  });

  test("a scope sees its own clients, and * sees every client", () => {
    const scoped = {
      id: "laptop",
      nodeStableId: "n",
      clients: ["halcyon"],
      issuedAt: "",
    };
    expect(canSee(scoped, "halcyon")).toBe(true);
    expect(canSee(scoped, "kestrel")).toBe(false);
    expect(canSee({ ...scoped, clients: [everyClient] }, "kestrel")).toBe(true);
    expect(canSee(undefined, "kestrel")).toBe(true);
  });
});

describe("identifying a caller", () => {
  test("trusts X-Forwarded-For only on a loopback connection", () => {
    const forwarded = request({ "x-forwarded-for": "100.64.0.1" });
    expect(callerAddress(forwarded, "127.0.0.1")).toBe("100.64.0.1");
    expect(callerAddress(forwarded, "100.64.0.2")).toBe("100.64.0.2");
    expect(callerAddress(request(), "127.0.0.1")).toBe("127.0.0.1");
  });

  test("a token from its own node is that machine", async () => {
    const token = issueMachineToken(database, {
      id: "laptop",
      nodeStableId: "node-laptop",
      clients: ["*"],
    });
    const caller = await identify(
      request({ authorization: `Bearer ${token}` }),
      "100.64.0.1",
      database,
      lookupNode,
    );
    expect(caller).toMatchObject({
      kind: "machine",
      machine: { id: "laptop" },
    });
  });

  test("a token from another node is refused", async () => {
    const token = issueMachineToken(database, {
      id: "laptop",
      nodeStableId: "node-laptop",
      clients: ["*"],
    });
    for (const address of ["100.64.0.2", "203.0.113.9"])
      await expect(
        identify(
          request({ authorization: `Bearer ${token}` }),
          address,
          database,
          lookupNode,
        ),
      ).rejects.toThrow("another machine");
  });

  test("a wrong token is refused, not treated as anonymous", async () => {
    await expect(
      identify(
        request({ authorization: "Bearer atlas_wrong" }),
        "100.64.0.1",
        database,
        lookupNode,
      ),
    ).rejects.toThrow("not valid");
  });

  test("a person comes from Serve's identity header", async () => {
    expect(
      await identify(
        request({ "tailscale-user-login": "someone@example.com" }),
        "127.0.0.1",
        database,
        lookupNode,
      ),
    ).toEqual({ kind: "person", login: "someone@example.com" });
    expect(
      await identify(request(), "127.0.0.1", database, lookupNode),
    ).toEqual({ kind: "anonymous" });
  });
});

describe("the API with tokens required", () => {
  const api = () =>
    createApi({
      database,
      version: "0.0.0-test",
      requireTokens: true,
      lookupNode,
    });

  test("health stays open", async () => {
    expect((await api().handle(request({}, "/api/health")))?.status).toBe(200);
  });

  test("refuses an anonymous caller and admits a person", async () => {
    expect((await api().handle(request(), "127.0.0.1"))?.status).toBe(401);
    expect(
      (
        await api().handle(
          request({ "tailscale-user-login": "someone@example.com" }),
          "127.0.0.1",
        )
      )?.status,
    ).toBe(200);
  });

  test("admits a machine that sees every client, and sends a scoped one to MCP", async () => {
    const everything = issueMachineToken(database, {
      id: "mini",
      nodeStableId: "node-mini",
      clients: ["*"],
    });
    const scoped = issueMachineToken(database, {
      id: "laptop",
      nodeStableId: "node-laptop",
      clients: ["halcyon"],
    });
    expect(
      (
        await api().handle(
          request({ authorization: `Bearer ${everything}` }),
          "100.64.0.2",
        )
      )?.status,
    ).toBe(200);
    expect(
      (
        await api().handle(
          request({ authorization: `Bearer ${scoped}` }),
          "100.64.0.1",
        )
      )?.status,
    ).toBe(403);
  });

  test("MCP refuses a caller without a machine token", async () => {
    const response = await api().handle(
      new Request("http://atlas.test/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "tailscale-user-login": "someone@example.com",
        },
        body: "{}",
      }),
      "127.0.0.1",
    );
    expect(response?.status).toBe(401);
  });

  test("MCP shows a scoped machine only its own clients", async () => {
    const token = issueMachineToken(database, {
      id: "laptop",
      nodeStableId: "node-laptop",
      clients: ["halcyon"],
    });
    const server = api();
    const client = new Client({ name: "atlas-test", version: "0.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://atlas.test/mcp"), {
        requestInit: { headers: { authorization: `Bearer ${token}` } },
        fetch: async (input, init) =>
          (await server.handle(new Request(input, init), "100.64.0.1")) ??
          new Response("Not found", { status: 404 }),
      }),
    );
    const listed = (await client.callTool({ name: "list_agents" })) as {
      content: { text: string }[];
    };
    const agents = JSON.parse(listed.content[0]!.text) as {
      clientId: string;
    }[];
    expect(agents.length).toBeGreaterThan(0);
    expect(new Set(agents.map((agent) => agent.clientId))).toEqual(
      new Set(["halcyon"]),
    );
    const outside = sampleDataset.agents.find(
      (agent) =>
        sampleDataset.groups.find((group) => group.id === agent.groupId)
          ?.clientId !== "halcyon",
    )!;
    const refused = (await client.callTool({
      name: "report_status",
      arguments: { agentId: outside.id, status: "idle", note: "Not mine" },
    })) as { isError?: boolean };
    expect(refused.isError).toBe(true);
    const outsideItem = sampleDataset.items.find(
      (item) => item.clientId !== "halcyon",
    )!;
    for (const [parentId, workingOn] of [
      [outside.id, []],
      ["schema", [outsideItem.id]],
    ] as const) {
      const launch = (await client.callTool({
        name: "launch_vessel",
        arguments: {
          parentId,
          vesselId: "out-of-scope",
          name: "Out of scope",
          workingOn,
          note: "Not mine",
        },
      })) as { isError?: boolean };
      expect(launch.isError).toBe(true);
    }
    const returned = (await client.callTool({
      name: "return_vessel",
      arguments: { vesselId: outside.id, note: "Not mine" },
    })) as { isError?: boolean };
    expect(returned.isError).toBe(true);
    await client.close();
  });
});
