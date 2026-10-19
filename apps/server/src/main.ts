/**
 * Starts the Atlas server. The log holds methods, paths, statuses and
 * counts only, never the text of a record or an event.
 */
import { sampleDataset } from "@atlas/fixtures";

import rootPackage from "../../../package.json" with { type: "json" };
import { createApi } from "./api";
import { readConfiguration } from "./configuration";
import { openDatabase } from "./database";
import { isEmpty, seedDataset } from "./store";

const configuration = readConfiguration();
const database = openDatabase(configuration.databasePath);

if (isEmpty(database)) {
  if (configuration.seedFixtures) {
    seedDataset(database, sampleDataset);
    console.log(
      `seeded the invented dataset: ${sampleDataset.clients.length} clients, ${sampleDataset.agents.length} agents`,
    );
  } else {
    console.log(
      "the database is empty; set ATLAS_SEED=fixtures to seed the invented dataset",
    );
  }
}

const api = createApi({ database, version: rootPackage.version });

const server = Bun.serve({
  hostname: configuration.hostname,
  port: configuration.port,
  // The event stream stays open; Bun's default idle timeout would cut it.
  idleTimeout: 0,
  async fetch(request) {
    const response =
      (await api.handle(request)) ?? new Response("Not found", { status: 404 });
    console.log(
      `${request.method} ${new URL(request.url).pathname} ${response.status}`,
    );
    return response;
  },
});

console.log(`atlas ${rootPackage.version} listening on ${server.url}`);

function shutdown() {
  api.close();
  server.stop();
  database.$client.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
