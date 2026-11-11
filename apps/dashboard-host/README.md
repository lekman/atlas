# Dashboard Host

The local MCP server that the sidebar calls as `host:dashboard`. It is
Python 3.9 or later with the standard library only, and it talks MCP over
stdio.

Three things start it:

| Caller                        | How it finds the command                                                      |
| ----------------------------- | ----------------------------------------------------------------------------- |
| The Claude desktop app        | `mcpServers.dashboard` in `claude_desktop_config.json`                        |
| The VS Code planner view      | The same entry in the Claude desktop config                                   |
| The Atlas server (`/sidebar`) | `ATLAS_DASHBOARD_MCP_COMMAND`, see [Architecture](../../docs/architecture.md) |

The sidebar artifact calls the server by name only, so it never needs a
path.

## Files

| File                | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `dashboard_mcp.py`  | The server: the tool list, the worklist, task actions, Commander requests |
| `host_config.py`    | Where the configuration folder and the vault are, and the client maps     |
| `tasks_source.py`   | Reads and writes the task database through its MCP server                 |
| `sync_tasks.py`     | Parses `Dashboard.md` into worklist items                                 |
| `dashboard_edit.py` | Ticks or moves one `Dashboard.md` item                                    |
| `sync_events.py`    | Reads the calendar feeds for the Refresh button                           |
| `sync_jira.py`      | Reads the Jira tickets for the Refresh button                             |

## Configuration

The code holds no endpoints, tokens or client names. They live in a
configuration folder outside the repository, named by environment variables:

| Variable               | What it sets                                    | Default                        |
| ---------------------- | ----------------------------------------------- | ------------------------------ |
| `DASHBOARD_HOME`       | The configuration folder                        | This folder                    |
| `DASHBOARD_VAULT`      | The Obsidian vault that holds `Dashboard.md`    | The parent of `DASHBOARD_HOME` |
| `DASHBOARD_RELAY_ONLY` | `1` offers the Commander tools and nothing else | Off                            |

The configuration folder holds:

| File               | What it holds                                                                 |
| ------------------ | ----------------------------------------------------------------------------- |
| `clients.json`     | Client group headings, display names and GitHub organisations, per client key |
| `tasks.json`       | The task database URL, the Keychain service for its token, the client map     |
| `commander.json`   | The Commander endpoint and its token                                          |
| `feeds.json`       | Calendar feeds                                                                |
| `jira.json`        | Jira site, account and queries                                                |
| `release_state.py` | Optional. The release check behind `release_status`                           |

`host_config.py` describes the shape of `clients.json`. A missing file turns
off the feature that reads it rather than stopping the server.

## Registering It

Point the caller at a checkout of this repository on `main`, and set the
configuration folder. In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dashboard": {
      "command": "/usr/bin/python3",
      "args": ["/path/to/atlas/apps/dashboard-host/dashboard_mcp.py"],
      "env": { "DASHBOARD_HOME": "/path/to/vault/_Dashboard Sync" }
    }
  }
}
```

The Atlas server starts the command with the MCP SDK's default environment
(`HOME`, `LOGNAME`, `PATH`, `SHELL`, `TERM`, `USER`), so a `DASHBOARD_HOME`
set on the server never reaches this process. Set it inside the command with
`env`, quoting the whole assignment when the path holds spaces:

```sh
ATLAS_DASHBOARD_MCP_COMMAND='/usr/bin/env "DASHBOARD_HOME=/path/to/vault/_Dashboard Sync" /usr/bin/python3 /path/to/atlas/apps/dashboard-host/dashboard_mcp.py'
```

Quit and reopen the Claude desktop app after a change: it starts the server
once, when it opens.
