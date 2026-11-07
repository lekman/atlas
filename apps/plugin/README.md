# Atlas Plugin for Claude Code

A Claude Code plugin that tells Atlas what a session is doing, from Claude
Code's own hook events, so the agent does not have to report it.

| Hook event                       | What Atlas shows                                                |
| -------------------------------- | --------------------------------------------------------------- |
| `SubagentStart`                  | A vessel leaves the session's agent, named by the subagent type |
| `SubagentStop`                   | The vessel returns                                              |
| `SessionEnd`                     | Every vessel the session still has out returns                  |
| `Notification`, permission asked | The session's agent turns amber: waiting for approval           |

The collector clears "Waiting for approval in its session" once the
session works again, so the plugin only has to set it.

## Install

```sh
claude plugin install atlas --marketplace lekman/atlas
```

Inside a Claude Code session, run `/plugin marketplace add lekman/atlas`
and then `/plugin install atlas@atlas`.

It needs Bun on the `PATH` and a machine token for Atlas in the macOS
Keychain, as the collector uses:

```sh
security add-generic-password -s atlas-token -a atlas -w
```

Atlas's address is `ATLAS_MCP_URL`, by default the server's tailnet
address. An address on `127.0.0.1` or `localhost`, such as `task server`,
needs no token.

## How a Session Finds Its Agent

The plugin reads the session's name from its record in
`~/.claude/sessions` and matches it to an Atlas agent the way the collector
does: the same name without regard to case, or a name followed by a hyphen
(agent "Halcyon" for session "halcyon-69"). A session that matches no agent
is left alone.

## What Leaves the Machine

Only the session's agent id, a vessel id made from Claude Code's subagent
id, the subagent type (dropped unless it is a plain name) and fixed notes.
No prompt, message, tool input, file path or working folder is sent. The
hook keeps those fields out on parse, before anything else runs.

## How It Stays Out of the Way

Claude Code waits for a hook, so the command keeps the few fields it needs,
hands them to a detached copy of itself and exits, in about 30 ms. The copy
talks to Atlas. When it cannot (no token, Atlas unreachable, no matching
agent) it does nothing. A failure is one line in `~/.claude/atlas/plugin.log`:
the event, the tool and a fixed reason such as `unreachable` or `http 401`.
Each vessel a session has out is an empty file under
`~/.claude/atlas/vessels/<session id>/`, so subagents that start together
never write the same file.

## Credit

Reading subagents from hooks instead of asking agents to report them comes
from [apiarius](https://github.com/yusuflkq/apiarius) (MIT), which shows a
session's agents live in Claude Code.
