import { describe, expect, it } from "bun:test";

(globalThis as { __SIDEBAR_CONFIG__?: unknown }).__SIDEBAR_CONFIG__ = {
  clients: [],
  trackers: [],
};
const { hostsFor } = await import("../src/hosts");

const host = (host: string, clientId: string) => ({ host, clientId });
const hosts = [
  host("server", "home"),
  host("laptop", "acme"),
  host("runner", "beta"),
  host("runner-2", "beta"),
];
const config = {
  clients: [],
  trackers: [],
  hostFilters: {
    acme: { clients: ["acme"] },
    beta: { hosts: ["server", "runner*"] },
    home: { notClients: ["acme"] },
  },
};
const names = (focus: string) =>
  hostsFor(hosts, focus, config).map((h) => h.host);

describe("hostsFor", () => {
  it("shows every host for all clients", () => {
    expect(names("all")).toEqual(["server", "laptop", "runner", "runner-2"]);
  });

  it("follows a client's filter: listed clients, names and prefixes, or all but some", () => {
    expect(names("acme")).toEqual(["laptop"]);
    expect(names("beta")).toEqual(["server", "runner", "runner-2"]);
    expect(names("home")).toEqual(["server", "runner", "runner-2"]);
  });

  it("shows a client's own hosts when it has no filter", () => {
    expect(
      hostsFor(hosts, "beta", { clients: [], trackers: [] }).map((h) => h.host),
    ).toEqual(["runner", "runner-2"]);
  });

  it("uses the server's client key where it sends one", () => {
    expect(
      hostsFor(
        [{ host: "x", clientId: "acme-ltd", customer: "acme" }],
        "acme",
        config,
      ).map((h) => h.host),
    ).toEqual(["x"]);
  });
});
