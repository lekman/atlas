/**
 * Starts the Atlas server. The log holds methods, paths, statuses and
 * counts only, never the text of a record or an event.
 */
import { join } from "node:path";

import { sampleDataset } from "@atlas/fixtures";
import webApp from "@atlas/web/index.html";

import rootPackage from "../../../package.json" with { type: "json" };
import { commandLineLauncher, createAccountSwitcher } from "./account-switch";
import { createApi } from "./api";
import { createDashboardHost, stdioConnector } from "./dashboard-host";
import { readConfiguration } from "./configuration";
import { openDatabase } from "./database";
import { createDispatcher } from "./dispatcher";
import {
  commanderWaker,
  githubCommandLineMerger,
  tasksApi,
} from "./dispatcher-connections";
import { tasksMessages } from "./agent-questions";
import { defaultDispatcherSettings } from "./dispatcher-rules";
import { createGithubReader } from "./github-reader";
import { createIdleWatcher } from "./idle-with-work";
import { createSessionReader } from "./session-source";
import { sidebarPageFile } from "./sidebar-routes";
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

// The dispatcher acts on GitHub signals. Tokens are read by their
// commands when a call needs them, never at start and never logged.
function dispatcher() {
  const settings = configuration.dispatcher;
  if (!settings) return undefined;
  return createDispatcher({
    database,
    settings: settings.settings,
    by: settings.by,
    ...(settings.tasksApi
      ? {
          tasks: tasksApi({
            url: settings.tasksApi.url,
            token: passwordFromCommand(settings.tasksApi.tokenCommand),
          }),
        }
      : {}),
    ...(settings.commander
      ? {
          waker: commanderWaker({
            url: settings.commander.url,
            token: passwordFromCommand(settings.commander.tokenCommand),
          }),
        }
      : {}),
    merger: githubCommandLineMerger(settings.githubCommand),
  });
}
const signalDispatcher = configuration.githubStateDirectory
  ? dispatcher()
  : undefined;

// Pull request and issue state from gh-events' files, when configured.
const github = configuration.githubStateDirectory
  ? createGithubReader({
      directory: configuration.githubStateDirectory,
      database,
      ...(signalDispatcher ? { dispatcher: signalDispatcher } : {}),
      sweepOpenAlerts: configuration.dispatcher?.sweepOpenAlerts ?? false,
    })
  : undefined;

// The account-switch rule, when an accounts file is configured. It is off
// unless the file switches it on; limits are noted either way.
const accounts = configuration.sessions?.accounts;
const switcher = accounts
  ? createAccountSwitcher({
      database,
      settings: accounts.settings,
      ...(accounts.launcher
        ? { launcher: commandLineLauncher(accounts.launcher) }
        : {}),
    })
  : undefined;

// Live agent status from Claude Code's session files, when configured: one
// folder, or one per account.
const sessions = configuration.sessions
  ? createSessionReader({
      ...(configuration.sessions.directory
        ? { directory: configuration.sessions.directory }
        : {}),
      ...(accounts
        ? {
            folders: accounts.settings.accounts.map((account) => ({
              account: account.name,
              sessions: join(account.directory, "sessions"),
              projects: join(account.directory, "projects"),
            })),
          }
        : {}),
      database,
      pollSeconds: configuration.sessions.pollSeconds,
      forgetHours: configuration.sessions.forgetHours,
      ...(switcher
        ? {
            onUsageLimit: (session, connection) =>
              switcher.handle(session, connection),
          }
        : {}),
    })
  : undefined;

// Agents idle with open work, whenever live agent status is on. The nudge
// rule follows the dispatcher file, and is off with the dispatcher.
const idle = sessions
  ? createIdleWatcher({
      database,
      sessions,
      settings: (
        configuration.dispatcher?.settings ?? defaultDispatcherSettings
      ).idleWithWork,
      mode:
        configuration.dispatcher?.settings.rules["nudge-idle-with-work"] ??
        "off",
      ...(configuration.dispatcher?.commander
        ? {
            waker: commanderWaker({
              url: configuration.dispatcher.commander.url,
              token: passwordFromCommand(
                configuration.dispatcher.commander.tokenCommand,
              ),
            }),
          }
        : {}),
    })
  : undefined;

// The dashboard MCP server for the sidebar page, started on its first call.
const dashboard = configuration.dashboardCommand
  ? createDashboardHost(stdioConnector(configuration.dashboardCommand))
  : undefined;

// Every start is a new build as far as open pages are concerned: a deploy
// restarts the server, and the pages reload when they reconnect.
const build = `${rootPackage.version}-${Date.now().toString(36)}`;
const api = createApi({
  database,
  version: rootPackage.version,
  build,
  requireTokens: configuration.requireTokens,
  fakeDevelopment: configuration.fakeDevelopment,
  ...(tasks ? { tasks } : {}),
  ...(github ? { github } : {}),
  ...(sessions ? { sessions } : {}),
  ...(signalDispatcher ? { dispatcher: signalDispatcher } : {}),
  ...(configuration.messages
    ? {
        messages: tasksMessages({
          url: configuration.messages.url,
          token: passwordFromCommand(configuration.messages.tokenCommand),
        }),
      }
    : {}),
  ...(idle ? { idle } : {}),
  ...(dashboard ? { dashboard } : {}),
  ...(configuration.sidebarFile
    ? { sidebarPage: sidebarPageFile(configuration.sidebarFile) }
    : {}),
});
// Answers to agents' questions go out, and their delivery is read back,
// every 30 seconds, besides straight after each answer.
if (configuration.messages) {
  void api.questions.deliver();
  api.questions.start(30);
}
if (github) {
  github.poll();
  github.start();
}
if (sessions) {
  sessions.poll();
  sessions.start();
}
if (idle) {
  idle.check();
  idle.start();
}

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
  `atlas ${rootPackage.version} listening on ${server.url}, tokens ${configuration.requireTokens ? "required" : "optional"}, tasks from ${tasks ? "the task database" : "SQLite"}${github ? ", GitHub state from gh-events" : ""}${signalDispatcher ? ", dispatcher on" : ""}${sessions ? ", agent status from Claude Code sessions" : ""}${idle ? `, idle-with-work nudges ${configuration.dispatcher?.settings.rules["nudge-idle-with-work"] ?? "off"}` : ""}${configuration.messages ? ", answers to agents through the tasks server" : ""}${accounts ? `, ${accounts.settings.accounts.length} accounts, switch ${accounts.settings.mode}` : ""}${configuration.fakeDevelopment ? ", development tracking fake" : ""}${configuration.sidebarFile ? ", sidebar page on" : ""}${dashboard ? ", dashboard server for the sidebar" : ""}`,
);

function shutdown() {
  tasks?.stop();
  github?.stop();
  sessions?.stop();
  idle?.stop();
  api.close();
  void dashboard?.close();
  server.stop();
  database.$client.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
