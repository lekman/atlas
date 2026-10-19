/**
 * Starts the Atlas server. The log holds methods, paths, statuses and
 * counts only, never the text of a record or an event.
 */
import { sampleDataset } from "@atlas/fixtures";
import webApp from "@atlas/web/index.html";

import rootPackage from "../../../package.json" with { type: "json" };
import { createApi } from "./api";
import { readConfiguration } from "./configuration";
import { openDatabase } from "./database";
import { isEmpty, readSeedFile, seedDataset } from "./store";

const configuration = readConfiguration();
const database = openDatabase(configuration.databasePath);

if (isEmpty(database)) {
  const { seed } = configuration;
  if (seed.kind === "none") {
    console.log(
      "the database is empty; set ATLAS_SEED to fixtures or to a seed file",
    );
  } else {
    const dataset =
      seed.kind === "fixtures" ? sampleDataset : await readSeedFile(seed.path);
    seedDataset(database, dataset);
    console.log(
      `seeded from ${seed.kind}: ${dataset.clients.length} clients, ${dataset.agents.length} agents, ${dataset.items.length} items`,
    );
  }
}

const api = createApi({
  database,
  version: rootPackage.version,
  requireTokens: configuration.requireTokens,
});

const server = Bun.serve({
  hostname: configuration.hostname,
  port: configuration.port,
  // The event stream stays open; Bun's default idle timeout would cut it.
  idleTimeout: 0,
  // Bun bundles the web app once at start, minified, rather than on each request.
  development: false,
  routes: { "/": webApp },
  async fetch(request, server) {
    const response =
      (await api.handle(request, server.requestIP(request)?.address)) ??
      new Response("Not found", { status: 404 });
    console.log(
      `${request.method} ${new URL(request.url).pathname} ${response.status}`,
    );
    return response;
  },
});

console.log(
  `atlas ${rootPackage.version} listening on ${server.url}, tokens ${configuration.requireTokens ? "required" : "optional"}`,
);

function shutdown() {
  api.close();
  server.stop();
  database.$client.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
