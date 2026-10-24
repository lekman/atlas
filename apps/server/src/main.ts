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
import { createTaskCache } from "./task-cache";
import { passwordFromCommand, postgresTaskSource } from "./task-database";
import { onlyClients } from "./task-source";

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

// The task database, when configured. The first read finishes (or fails)
// before the server listens, so the first page already has the tasks.
function taskSource() {
  if (!configuration.tasks) return undefined;
  const tasksConfiguration = configuration.tasks;
  const source = postgresTaskSource({
    hostname: tasksConfiguration.hostname,
    port: tasksConfiguration.port,
    database: tasksConfiguration.database,
    username: tasksConfiguration.username,
    ...(tasksConfiguration.passwordCommand
      ? { password: passwordFromCommand(tasksConfiguration.passwordCommand) }
      : {}),
  });
  return tasksConfiguration.clients
    ? onlyClients(source, tasksConfiguration.clients)
    : source;
}
const source = taskSource();
const tasks =
  source && configuration.tasks
    ? createTaskCache({ source, pollSeconds: configuration.tasks.pollSeconds })
    : undefined;
if (tasks) {
  await tasks.refresh();
  tasks.start();
}

// Every start is a new build as far as open pages are concerned: a deploy
// restarts the server, and the pages reload when they reconnect.
const build = `${rootPackage.version}-${Date.now().toString(36)}`;
const api = createApi({
  database,
  version: rootPackage.version,
  build,
  requireTokens: configuration.requireTokens,
  ...(tasks ? { tasks } : {}),
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
  `atlas ${rootPackage.version} listening on ${server.url}, tokens ${configuration.requireTokens ? "required" : "optional"}, tasks from ${tasks ? "the task database" : "SQLite"}`,
);

function shutdown() {
  tasks?.stop();
  api.close();
  server.stop();
  database.$client.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
