"""Where the dashboard server finds its configuration, the vault and the client names.

The code lives in this folder. The configuration lives in a folder of its own, because it holds
endpoints, Keychain service names and client names that never belong in the repository:

- DASHBOARD_HOME: the configuration folder (commander.json, tasks.json, feeds.json, jira.json,
  clients.json, and an optional release_state.py). Defaults to this folder.
- DASHBOARD_VAULT: the Obsidian vault that holds Dashboard.md and the details pages. Defaults to
  the parent of DASHBOARD_HOME, the layout where the configuration folder sits inside the vault.

clients.json maps the dashboard's client groups to the page's customer keys, and each key to the
name Commander shows and the GitHub organisation its pull requests are found in:

{
  "headings": {"halcyon labs": "halcyon"},
  "names": {"halcyon": "Halcyon Labs"},
  "githubOrgs": {"halcyon": "halcyon-labs"}
}

A missing file or key leaves that map empty: every group reads as "other", and no pull requests
are looked up.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

CODE_DIR = Path(__file__).resolve().parent
CONFIG_DIR = Path(os.environ.get("DASHBOARD_HOME") or CODE_DIR).expanduser().resolve()
VAULT_DIR = Path(os.environ.get("DASHBOARD_VAULT") or CONFIG_DIR.parent).expanduser().resolve()
DASHBOARD = VAULT_DIR / "Dashboard.md"

_clients: dict = {"mtime": None, "value": None}


def config_file(name: str) -> Path:
    """A file in the configuration folder."""
    return CONFIG_DIR / name


def clients() -> dict:
    """clients.json, re-read when it changes. Always has the three maps, and "other" in names."""
    path = config_file("clients.json")
    try:
        mtime = path.stat().st_mtime
    except OSError:
        mtime = None
    if _clients["value"] is None or mtime != _clients["mtime"]:
        raw = json.loads(path.read_text(encoding="utf-8")) if mtime is not None else {}
        value = {key: {str(k): str(v) for k, v in (raw.get(key) or {}).items()}
                 for key in ("headings", "names", "githubOrgs")}
        value["headings"] = {k.lower(): v for k, v in value["headings"].items()}
        value["names"].setdefault("other", "Other")
        _clients.update(mtime=mtime, value=value)
    return _clients["value"]
