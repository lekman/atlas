/** Invented Shields data for the stories, timed against the sidebar's story clock. */
import { STORY_NOW } from "../../sidebar/stories/examples";
import { hostsDoc } from "../../sidebar/stories/hosts";
import type { HostNetworkDoc } from "../network";
import type { IntegrationInput } from "../shields";

const minutesAgo = (m: number) =>
  new Date(STORY_NOW.getTime() - m * 60000).toISOString();

export const storyHosts = hostsDoc.hosts;

export const storyIntegrations: IntegrationInput[] = [
  { id: "tasks", name: "Task database", syncedAt: minutesAgo(1) },
  { id: "worklist", name: "Worklist", syncedAt: minutesAgo(1) },
  { id: "jira", name: "Jira", syncedAt: minutesAgo(95) },
  {
    id: "calendar",
    name: "Calendars",
    syncedAt: null,
    error: "Asked to slow down; retrying in 15 minutes",
  },
];

/** Invented networks, with documentation-only addresses (RFC 5737) and a tailnet in 100.64.0.0/10. */
export const storyNetwork: HostNetworkDoc = {
  hosts: [
    {
      host: "build-01",
      reportedAt: minutesAgo(2),
      report: {
        collectedAt: minutesAgo(2),
        localAddresses: [{ interface: "en0", address: "192.0.2.20" }],
        externalAddress: "198.51.100.7",
        dns: ["100.100.100.100", "192.0.2.1"],
        wifi: null,
        services: [
          { label: "com.ashgrove.atlas.server", running: true },
          { label: "com.ashgrove.backup", running: false, lastExit: 0 },
          {
            label: "com.ashgrove.runner-launcher",
            running: false,
            lastExit: 78,
          },
        ],
        ports: [
          { port: 5432, address: "127.0.0.1", process: "postgres" },
          { port: 7400, address: "127.0.0.1", process: "bun" },
          { port: 8443, address: "*", process: "node" },
        ],
      },
      tailscale: {
        id: "nExample1CNTRL",
        name: "build-01",
        dnsName: "build-01.example.ts.net",
        addresses: ["100.64.0.10", "fd7a:115c:a1e0::a"],
        os: "macOS",
        online: true,
        lastSeen: null,
        self: true,
        serveUrls: [
          "https://build-01.example.ts.net",
          "https://build-01.example.ts.net/share",
        ],
      },
    },
    {
      host: "laptop",
      reportedAt: minutesAgo(4),
      report: {
        collectedAt: minutesAgo(4),
        localAddresses: [{ interface: "en0", address: "192.0.2.44" }],
        externalAddress: "198.51.100.7",
        dns: ["100.100.100.100"],
        wifi: "Ashgrove Office",
        services: [
          { label: "com.ashgrove.hoststat", running: false, lastExit: 0 },
        ],
        ports: [{ port: 6274, address: "127.0.0.1", process: "python3" }],
      },
      tailscale: {
        id: "nExample2CNTRL",
        name: "laptop",
        dnsName: "laptop.example.ts.net",
        addresses: ["100.64.0.20"],
        os: "macOS",
        online: true,
        lastSeen: null,
        self: false,
        serveUrls: [],
      },
    },
    {
      host: "phone",
      reportedAt: null,
      report: null,
      tailscale: {
        id: "nExample3CNTRL",
        name: "phone",
        dnsName: "phone.example.ts.net",
        addresses: ["100.64.0.30"],
        os: "iOS",
        online: false,
        lastSeen: minutesAgo(90),
        self: false,
        serveUrls: [],
      },
    },
  ],
};
