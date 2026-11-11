"""Worklist items for clients that live in the task database, read live from the tasks MCP server.

tasks.json (in the configuration folder, see host_config.py) names the server URL, the Keychain service that holds its token, and
which database clients replace their Dashboard.md groups, mapped to the page's customer keys:
{"url": ..., "keychainService": "tasks-mcp-token", "by": "Dashboard", "clients": {"halcyon-labs": "halcyon"}}

The token is read from the macOS Keychain on each call and never logged or returned.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

import host_config

PRIORITY = {"high": "high", "normal": "medium", "low": "low"}  # the page's words
REF_PREFIX = "db:"


# A task's detailsId is its vault details page's file name in lower case with hyphens (/planner:goal sets it).
# The index maps each such slug to the page's path in the vault, rebuilt every few minutes.
_details = {"at": 0.0, "index": {}}
DETAILS_TTL = 300


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def details_path(details_id) -> str | None:
    """The vault-relative path of a task's details page, or None when there is no such page."""
    if not isinstance(details_id, str) or not details_id:
        return None
    if time.time() - _details["at"] > DETAILS_TTL or details_id not in _details["index"] and time.time() - _details["at"] > 60:
        vault, index = host_config.VAULT_DIR, {}
        for root, dirs, files in os.walk(vault):
            dirs[:] = [d for d in dirs if not d.startswith((".", "_"))]
            for f in files:
                if f.endswith(".md"):
                    rel = os.path.relpath(os.path.join(root, f), vault)
                    # A page outside Archive wins over an archived page with the same name.
                    if _slug(f[:-3]) not in index or index[_slug(f[:-3])].startswith("Archive/"):
                        index[_slug(f[:-3])] = rel
        _details.update(at=time.time(), index=index)
    return _details["index"].get(details_id)


class TasksError(RuntimeError):
    """A failure the page can show as it is: it never quotes the request or the token."""


def config() -> dict | None:
    path = host_config.config_file("tasks.json")
    if not path.exists():
        return None
    conf = json.loads(path.read_text(encoding="utf-8"))
    if not str(conf.get("url") or "").startswith(("http://", "https://")) or not conf.get("clients"):
        raise TasksError("tasks.json needs a url and at least one client")
    return conf


def _token(conf: dict) -> str:
    service = conf.get("keychainService") or "tasks-mcp-token"
    try:
        out = subprocess.run(["/usr/bin/security", "find-generic-password", "-s", service, "-w"],
                             capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        raise TasksError("couldn't read the tasks token from the Keychain") from None
    token = out.stdout.strip()
    if out.returncode != 0 or not token:
        raise TasksError(f"no tasks token in the Keychain under {service}")
    return token


def call(conf: dict, tool: str, arguments: dict):
    """One tools/call to the tasks server; returns the tool's JSON answer."""
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": {"name": tool, "arguments": arguments}}).encode("utf-8")
    req = urllib.request.Request(conf["url"], data=body, method="POST", headers={
        "Authorization": f"Bearer {_token(conf)}", "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode("utf-8")
    except urllib.error.HTTPError as ex:
        raise TasksError("the tasks server refused the token (401)" if ex.code == 401
                         else f"the tasks server answered HTTP {ex.code}") from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise TasksError("the tasks server didn't answer; is the Mac mini awake and on the tailnet?") from None
    # Streamable HTTP may answer as server-sent events: take the last data line.
    lines = [l[5:].strip() for l in raw.splitlines() if l.startswith("data:")]
    try:
        msg = json.loads(lines[-1] if lines else raw)
    except ValueError:
        raise TasksError("the tasks server's answer wasn't JSON") from None
    if "error" in msg:
        raise TasksError(str((msg["error"] or {}).get("message") or "the tasks server returned an error")[:200])
    result = msg.get("result") or {}
    text = ((result.get("content") or [{}])[0] or {}).get("text") or ""
    if result.get("isError"):
        raise TasksError(text[:300] or f"{tool} was refused")
    try:
        return json.loads(text)
    except ValueError:
        return text


def next_working_day(d: date) -> date:
    d += timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def _item(s: dict, customer: str, today: date, order: int) -> dict:
    day = s.get("scheduledFor")
    if s.get("state") == "done":
        band, day = "today", s.get("doneOn") or today.isoformat()
    elif not day:
        band = "unscheduled"
    elif day <= today.isoformat():
        band = "today"
    elif day == next_working_day(today).isoformat():
        band = "tomorrow"
    else:
        band = "future"
    flags = set()
    if s.get("blocked"):
        flags.add("blocked")
    if s.get("kind") == "admin":
        flags.add("admin")
    if s.get("state") in ("doing", "review"):
        flags.add("active")
    if s.get("state") in ("approved", "merged"):
        flags.add(s["state"])  # waiting for a merge or a release; gh-events moves it on
    link = s.get("trackerUrl")
    return {
        "customer": customer, "band": band, "day": day, "title": s.get("title") or "(no title)",
        "done": s.get("state") == "done", "priority": PRIORITY.get(s.get("priority")),
        "flags": sorted(flags), "key": s.get("trackerKey"),
        "link": link if isinstance(link, str) and link.startswith("https://") else None,
        "meeting": None, "order": order, "ref": REF_PREFIX + s["id"], "details": details_path(s.get("detailsId")),
        "source": "database", "claimedBy": s.get("claimedBy"), "quadrant": s.get("quadrant"),
        "pullRequests": [p for p in s.get("pullRequests") or [] if isinstance(p, str)][:30] or None,
        "revision": s.get("revision"), "effort": s.get("effort"), "value": s.get("businessValue"), "due": s.get("due"),
    }


def items(today: date) -> tuple[list, dict]:
    """(items in the page's shape, the database source's status) for every configured client."""
    conf = config()
    if conf is None:
        return [], {"ok": True, "clients": []}
    out, order = [], 100000  # after Dashboard.md's own order numbers
    for client_id, customer in conf["clients"].items():
        for states in (None, ["done"]):
            args = {"clientId": client_id, "limit": 200}
            if states:
                args["states"] = states
            res = call(conf, "task_search", args)
            for s in (res or {}).get("items", []):
                if states and s.get("doneOn") != today.isoformat():
                    continue  # only today's done items, as the dashboard shows them
                order += 1
                out.append(_item(s, customer, today, order))
    return out, {"ok": True, "clients": list(conf["clients"].values())}


def customers() -> set:
    conf = config()
    return set(conf["clients"].values()) if conf else set()


def _owner_force(current: dict) -> dict:
    """The operator acts from the page, so an agent's claim never stops a done, a move or an assessment.
    The tasks server refuses an action on a claimed item unless `force` is set, so it is set only then."""
    return {"force": True} if current.get("claim") or current.get("claimedBy") else {}


def act(ref: str, action: str, to: str | None, today: date) -> None:
    """Done or move one database item, at its current revision, whoever has claimed it."""
    conf = config()
    if conf is None:
        raise TasksError("tasks.json isn't set up")
    item_id, by = ref[len(REF_PREFIX):], conf.get("by") or "Dashboard"
    current = call(conf, "task_get", {"id": item_id})
    revision = current["revision"]
    if action == "done":
        call(conf, "task_complete", {"by": by, "id": item_id, "revision": revision, **_owner_force(current)})
        return
    target = {"today": today.isoformat(), "tomorrow": next_working_day(today).isoformat(), "backlog": None}
    if to not in target:
        raise TasksError("move needs to: today, tomorrow or backlog")
    call(conf, "task_update", {"by": by, "id": item_id, "revision": revision, "scheduledFor": target[to],
                               **_owner_force(current)})


VALUES = ("negative", "none", "low", "medium", "high", "veryHigh")
EFFORTS = ("XS", "S", "M", "L", "XL")


def grade_many(grades: list) -> dict:
    """Set business value and effort on database items, each at the revision just read."""
    conf = config()
    if conf is None:
        raise TasksError("tasks.json isn't set up")
    by = conf.get("by") or "Dashboard"
    graded, skipped = [], []
    for g in grades:
        ref = g.get("ref") if isinstance(g, dict) else None
        if not isinstance(ref, str) or not ref.startswith(REF_PREFIX):
            skipped.append({"ref": ref, "why": "not a database item"})
            continue
        if g.get("value") not in VALUES or g.get("effort") not in EFFORTS:
            skipped.append({"ref": ref, "why": "value or effort out of range"})
            continue
        item_id = ref[len(REF_PREFIX):]
        try:
            current = call(conf, "task_get", {"id": item_id})
            call(conf, "task_update", {"by": by, "id": item_id, "revision": current["revision"],
                                       "businessValue": g["value"], "effort": g["effort"], **_owner_force(current)})
            graded.append(ref)
        except Exception as ex:  # one refusal must not stop the rest
            skipped.append({"ref": ref, "why": str(ex)[:120]})
    return {"graded": graded, "skipped": skipped}


def assess_one(ref: str, fields: dict) -> None:
    """Set or clear business value, effort and due date on one database item, at its current revision."""
    conf = config()
    if conf is None:
        raise TasksError("tasks.json isn't set up")
    if not isinstance(ref, str) or not ref.startswith(REF_PREFIX):
        raise TasksError("only task database items can be assessed")
    update = {}
    if "value" in fields:
        if fields["value"] is not None and fields["value"] not in VALUES:
            raise TasksError("value out of range")
        update["businessValue"] = fields["value"]
    if "effort" in fields:
        if fields["effort"] is not None and fields["effort"] not in EFFORTS:
            raise TasksError("effort out of range")
        update["effort"] = fields["effort"]
    if "due" in fields:
        due = fields["due"]
        if due is not None:
            try:
                due = date.fromisoformat(due).isoformat()
            except (TypeError, ValueError):
                raise TasksError("due must be YYYY-MM-DD or null") from None
        update["due"] = due
    if not update:
        raise TasksError("nothing to change")
    item_id = ref[len(REF_PREFIX):]
    current = call(conf, "task_get", {"id": item_id})
    call(conf, "task_update", {"by": conf.get("by") or "Dashboard", "id": item_id, "revision": current["revision"],
                               **update, **_owner_force(current)})


def act_many(refs: list, to: str, today: date) -> dict:
    """Move several database items to one band. Closed items are skipped. A claim does not stop the
    operator: claimed items move with force, like a single move."""
    conf = config()
    if conf is None:
        raise TasksError("tasks.json isn't set up")
    target = {"today": today.isoformat(), "tomorrow": next_working_day(today).isoformat(), "backlog": None}
    if to not in target:
        raise TasksError("move needs to: today, tomorrow or backlog")
    by = conf.get("by") or "Dashboard"
    moved, skipped = [], []
    for ref in refs:
        if not isinstance(ref, str) or not ref.startswith(REF_PREFIX):
            skipped.append({"ref": ref, "why": "not a database item"})
            continue
        item_id = ref[len(REF_PREFIX):]
        try:
            current = call(conf, "task_get", {"id": item_id})
            if current.get("state") in ("done", "dropped"):
                skipped.append({"ref": ref, "why": "closed"})
                continue
            if current.get("scheduledFor") == target[to]:
                skipped.append({"ref": ref, "why": "already there"})
                continue
            call(conf, "task_update", {"by": by, "id": item_id, "revision": current["revision"],
                                       "scheduledFor": target[to], **_owner_force(current)})
            moved.append(ref)
        except Exception as ex:  # one refusal must not stop the rest
            skipped.append({"ref": ref, "why": str(ex)[:120]})
    return {"moved": moved, "skipped": skipped}
