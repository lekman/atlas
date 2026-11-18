import { sampleDataset } from "@atlas/fixtures";
import { describe, expect, test } from "bun:test";

import {
  createApi,
  createHostNetwork,
  devicesFromStatus,
  openDatabase,
  seedDataset,
  serveUrlsFromStatus,
  type NetworkReport,
  type TailscaleDevice,
} from "../src";

const report: NetworkReport = {
  collectedAt: "2026-11-18T14:00:00Z",
  localAddresses: [{ interface: "en0", address: "192.0.2.10" }],
  externalAddress: "198.51.100.7",
  dns: ["192.0.2.1"],
  wifi: "Example Net",
  services: [
    { label: "com.example.server", running: true },
    { label: "com.example.backup", running: false, lastExit: 1 },
  ],
  ports: [{ port: 7400, address: "127.0.0.1", process: "bun" }],
};

const status = {
  Self: {
    ID: "n1",
    HostName: "Server",
    DNSName: "server.example.ts.net.",
    TailscaleIPs: ["100.64.0.1"],
    OS: "macOS",
  },
  Peer: {
    a: {
      ID: "n2",
      HostName: "MacBook",
      DNSName: "macbook.example.ts.net.",
      TailscaleIPs: ["100.64.0.2"],
      OS: "macOS",
      Online: false,
      LastSeen: "2026-11-18T13:00:00Z",
    },
    exit: {
      ID: "x",
      HostName: "exit-1",
      DNSName: "exit-1.vpn.ts.net.",
      TailscaleIPs: ["100.64.9.9"],
      OS: "",
      Online: true,
    },
  },
};

describe("tailscale status", () => {
  test("lists this machine and the reader's own devices, not exit nodes", () => {
    const devices = devicesFromStatus(status, [
      "https://server.example.ts.net",
    ]);
    expect(devices.map((d) => d.name)).toEqual(["server", "macbook"]);
    expect(devices[0]).toMatchObject({
      self: true,
      online: true,
      dnsName: "server.example.ts.net",
      serveUrls: ["https://server.example.ts.net"],
    });
    expect(devices[1]).toMatchObject({
      self: false,
      online: false,
      lastSeen: "2026-11-18T13:00:00Z",
      serveUrls: [],
    });
  });

  test("reads the https addresses this machine serves", () => {
    expect(
      serveUrlsFromStatus({
        Web: {
          "server.example.ts.net:443": { Handlers: { "/": {}, "/share": {} } },
          "server.example.ts.net:10000": { Handlers: { "/": {} } },
        },
      }),
    ).toEqual([
      "https://server.example.ts.net",
      "https://server.example.ts.net/share",
      "https://server.example.ts.net:10000",
    ]);
    expect(serveUrlsFromStatus(null)).toEqual([]);
  });
});

describe("host network store", () => {
  test("keeps each host's latest report and joins it to its Tailscale device", async () => {
    const database = openDatabase(":memory:");
    const devices = async (): Promise<TailscaleDevice[]> =>
      devicesFromStatus(status);
    const store = createHostNetwork({ database, devices });
    store.record("macbook", report, new Date("2026-11-18T14:00:05Z"));
    store.record(
      "macbook",
      { ...report, wifi: null },
      new Date("2026-11-18T14:05:05Z"),
    );
    const hosts = await store.list();
    expect(hosts.map((h) => h.host)).toEqual(["macbook", "server"]);
    expect(hosts[0]).toMatchObject({
      reportedAt: "2026-11-18T14:05:05.000Z",
      report: { wifi: null },
      tailscale: { id: "n2" },
    });
    expect(hosts[1]).toMatchObject({ report: null, tailscale: { self: true } });
  });
});

describe("the network routes", () => {
  const apiWith = (name: string | undefined) => {
    const database = openDatabase(":memory:");
    seedDataset(database, sampleDataset);
    return createApi({
      database,
      version: "0.0.0-test",
      lookupNode: async () => undefined,
      lookupNodeName: async () => name,
      hostNetwork: createHostNetwork({ database, devices: async () => [] }),
    });
  };
  const post = (api: ReturnType<typeof createApi>, body: unknown) =>
    api.handle(
      new Request("http://atlas.test/api/hosts/network", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "tailscale-user-login": "reader@example.com",
        },
        body: JSON.stringify(body),
      }),
      "100.64.0.2",
    );

  test("names the host by the calling node, never by the body", async () => {
    const api = apiWith("macbook");
    const response = await post(api, { ...report, host: "server" });
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ host: "macbook", recorded: true });
    const list = await api.handle(
      new Request("http://atlas.test/api/hosts/network", {
        headers: { "tailscale-user-login": "reader@example.com" },
      }),
      "100.64.0.2",
    );
    const { hosts } = (await list!.json()) as {
      hosts: Array<{ host: string }>;
    };
    expect(hosts.map((h) => h.host)).toEqual(["macbook"]);
  });

  test("refuses a report from a device the tailnet does not know", async () => {
    expect((await post(apiWith(undefined), report))?.status).toBe(400);
  });

  test("refuses a report of another shape", async () => {
    expect(
      (await post(apiWith("macbook"), { ...report, dns: "one" }))?.status,
    ).toBe(400);
    expect(
      (await post(apiWith("macbook"), { ...report, wifi: "x".repeat(200) }))
        ?.status,
    ).toBe(400);
  });
});
