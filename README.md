# Atlas

Atlas is a personal console for someone who works across several clients with
AI agents. It shows your work for the day, the agents doing part of it, and
what is waiting for your answer, in one dark view built for a phone, a laptop
or a sidebar.

Atlas is personal. Shared work stays in Jira, GitHub or Monday. Atlas keeps a
pointer to each shared item together with your own grade, effort and notes. It
runs on a computer you own and is reachable only inside your own private
network.

[![Atlas on a folding phone held open: the Missions list on the left of the fold and the selected task on the right](docs/images/console-folding-phone-open.png)](https://lekman.github.io/atlas/?path=/story/pages-console--folding-phone-open-with-a-task)

The screenshots use invented clients. Each one opens its live story in
[the Storybook](https://lekman.github.io/atlas/).

## What You Can Do

The menu holds six sections, in this order:

| Section  | What it holds                                                                             |
| -------- | ----------------------------------------------------------------------------------------- |
| Missions | Today, tomorrow and the backlog, by client or by Covey quadrant, with Triage              |
| Beam     | Approvals and questions from your agents, answered in place                               |
| Radar    | Tickets and meetings that are not yet your work                                           |
| Agents   | Every agent by client: what it is doing, a live view of its work, and its messages to you |
| Shields  | Host health, the link to your server, and each integration                                |
| Log      | Finished work and its points, by day or by week                                           |

In Missions you can:

- see the day's scope, which is the number of tasks, their effort by size,
  meeting time and the blocked tasks left out (Atlas sets no limit, because
  what fits a day is your call);
- narrow the list to one client with the scope button;
- open a task, change its status, value and effort in place, mark it done, or
  move it to today, tomorrow or the backlog;
- press **Triage** to have your coordinating agent suggest a value and an
  effort for every task that has none. When its suggestions arrive, the
  Triage pane opens; change any, then save.

In Beam, a question can have several parts, each with its own choices. In
Agents, an agent's page shows its live view, the tasks it works on, and its
done, error and waiting messages, five to a page.

A star map of every client, its work and its agents is built but kept out of
the menu until it has a clear use.

On a phone away from your server, moves are queued and applied when the
server is back. The top bar always says which state you are in: Live, Stored
copy, or Queued with a count.

[![Atlas on a laptop: the Missions list on the left and the selected task with its pull requests on the right](docs/images/console-laptop-task.png)](https://lekman.github.io/atlas/?path=/story/pages-console--task-detail-on-a-laptop)

## Where It Runs

Atlas lays itself out from the space it is given, so one page serves:

| Where                              | Layout                                          |
| ---------------------------------- | ----------------------------------------------- |
| A sidebar beside a Claude artifact | One pane, the list or the task with a back link |
| A folding phone, closed            | One pane                                        |
| A folding phone, open              | The list and the task meet at the fold          |
| A laptop browser                   | The list at reading width, the task beside it   |

<a href="https://lekman.github.io/atlas/?path=/story/pages-console--in-the-sidebar"><img src="docs/images/console-sidebar.png" width="420" alt="Atlas at sidebar width: one pane with the Missions list and the menu down the right edge"></a>

The menu sits on one edge of the screen. The swap button at its top moves it
to the other edge, and Atlas remembers your choice for each layout.

## Install

### What You Need

- A computer that stays on, to run the Atlas server. Atlas is used on macOS.
- [Tailscale](https://tailscale.com) on that computer and on every device you
  open Atlas from. Atlas is never exposed to the internet.
- [Bun](https://bun.sh) 1.3 and Git.
- The local dashboard server from the
  [live dashboard](https://github.com/lekman/ai-toolkit/tree/main/practices/live-dashboard)
  practice in lekman/ai-toolkit. Atlas reads your worklist through it.

### Steps

1. Get Atlas.

   ```sh
   git clone https://github.com/lekman/atlas.git
   cd atlas
   bun install
   ```

2. Describe your clients. Copy the example configuration and replace the
   invented clients with your own. Keep the file outside the repository.

   ```sh
   cp apps/sidebar/sidebar.config.example.json ~/atlas.config.json
   ```

3. Build the page with your configuration.

   ```sh
   (cd apps/sidebar && SIDEBAR_CONFIG=~/atlas.config.json bun run build:console)
   ```

4. Start the server. Point it at the page and at the command that starts the
   dashboard server.

   ```sh
   ATLAS_CONSOLE_FILE="$PWD/apps/sidebar/dist-console/console.html" \
   ATLAS_DASHBOARD_MCP_COMMAND="python3 /path/to/dashboard_mcp.py" \
   bun run --cwd apps/server start
   ```

   The server listens on `127.0.0.1:7400`. Set `ATLAS_PORT` to use another
   port.

5. Share it on your tailnet.

   ```sh
   tailscale serve --bg 7400
   ```

6. Open `https://<computer>.<tailnet>.ts.net/console` on your phone or laptop.
   On a phone, add it to the home screen.

To keep Atlas running after a restart, start the command in step 4 from a
launchd agent on macOS or a systemd service on Linux.

### In the Claude Desktop App

The built page is a single HTML file. You can publish
`apps/sidebar/dist-console/console.html` as a Claude artifact and keep it open
in the sidebar beside your chat. In the desktop app the page reads your
worklist through the same local dashboard server. Declare it as
`host:dashboard`, with the tools the page calls. The list is
`dashboardTools` in `apps/server/src/dashboard-host.ts`.

### In VS Code

The Atlas extension in lekman/ai-toolkit (`packages/vscode-planner`) shows the
same page in a VS Code sidebar, and **Atlas: Open in Editor** opens it at full
width in an editor tab. It reads the page from your Obsidian vault. Copy the
build there with:

```sh
(cd apps/sidebar && ATLAS_VAULT_SYNC="/path/to/vault/_Dashboard Sync" bun run publish:vault)
```

## Privacy

Your tasks, clients and notes stay on your own computer and travel only
inside your tailnet. The repository holds no client content. Every example
uses an invented consultancy and four invented clients.

## Building or Changing Atlas

See [Maintainers](MAINTAINERS.md).

## Licence

[MIT](LICENSE)
