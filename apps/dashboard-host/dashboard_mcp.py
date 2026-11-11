#!/usr/bin/env python3
"""Local MCP server for the Dashboard artifact (stdio, standard library only).

Tools: release_status (the release check in the configuration folder's release_state.py, read-only `gh api` calls), worklist (Dashboard.md
merged with the clients that live in the task database, see tasks_source.py), task_done and task_move
(edit Dashboard.md, or the task database for its items), commander_send and commander_requests, and
sync_now (the Refresh button).

Register in Claude desktop (Settings > Developer > Edit Config) under "mcpServers" as "dashboard".
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

sys.dont_write_bytecode = True  # keep the vault free of __pycache__ folders
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import host_config  # noqa: E402

# release_state.py is configuration, so it is imported from the configuration folder.
sys.path.insert(1, str(host_config.CONFIG_DIR))
# Claude desktop starts servers with a short PATH; gh usually lives in Homebrew.
# Relay mode (DASHBOARD_RELAY_ONLY=1): the Mac mini keeps Atlas open only to forward phone requests to
# Commander. It offers the three Commander tools and nothing else, so it never reads Dashboard.md or the
# task database and never writes the page's store.
RELAY_ONLY = os.environ.get("DASHBOARD_RELAY_ONLY") == "1"
RELAY_TOOLS = ("commander_send", "commander_plan", "commander_requests", "commander_answer")

os.environ["PATH"] = os.pathsep.join(["/opt/homebrew/bin", "/usr/local/bin", os.environ.get("PATH", "/usr/bin:/bin")])

CACHE_SECONDS = 90
_lock = threading.Lock()
_cache: dict = {"at": 0.0, "value": None}


def log(*a):
    print("[dashboard-mcp]", *a, file=sys.stderr, flush=True)


ENVS = ("development", "staging", "production")


def env_state(info: dict | None) -> str | None:
    """One environment against its head (main for development, the release branch otherwise)."""
    if info is None:
        return None
    if info.get("state") in ("in_progress", "queued", "pending"):
        return "deploying"
    if info.get("state") in ("failure", "error"):
        return "failed"
    if not info.get("deployed"):
        return "none"
    return "ok" if info.get("head") and info["deployed"] == info["head"] else "behind"


def release_report() -> dict:
    import release_state as rs  # imported lazily so a broken script never stops the server

    branch = rs.release_branch()
    entries = rs.matrix()

    def read(e):
        try:
            return rs.read_repo(e, branch, False)
        except Exception as ex:  # one unreadable repository should not hide the others
            return {"repo": e.get("repo", "?"), "error": str(ex)[:200], "envs": {"staging": None}}

    with ThreadPoolExecutor(max_workers=8) as pool:
        rows = list(pool.map(read, entries))
    judged = [r for r in rows if "staging" in r["envs"] or "production" in r["envs"]]
    drifted, synced = [], 0
    for r in judged:
        if "error" in r:
            drifted.append({"repo": r["repo"], "reasons": [f"could not read: {r['error']}"], "envs": {}})
            continue
        # Drift = an environment not on its head. Main running ahead of the release branch alone is not drift.
        envs = {e: env_state(r["envs"].get(e)) for e in ENVS if e in r["envs"]}
        reasons = [x for x in rs.drift(r) if not x.startswith("main is ")]
        if r["release"] is None or any(v != "ok" for v in envs.values()):
            drifted.append({"repo": r["repo"], "reasons": reasons, "envs": envs})
        else:
            synced += 1
    return {
        "branch": branch,
        "checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": len(judged),
        "synced": synced,
        "drifted": sorted(drifted, key=lambda d: d["repo"]),
    }


def cached_report() -> dict:
    with _lock:  # concurrent calls share one run
        if _cache["value"] and time.time() - _cache["at"] < CACHE_SECONDS:
            return _cache["value"]
        value = release_report()
        _cache.update(at=time.time(), value=value)
        return value


def tasks_doc(dashboard):
    """The worklist: Dashboard.md, with the clients named in tasks.json read live from the task database instead."""
    import sync_tasks
    import tasks_source
    today = datetime.now().date()
    items = sync_tasks.parse(dashboard.read_text(encoding="utf-8"), today)
    try:
        moved = tasks_source.customers()
        db_items, database = tasks_source.items(today)
        items = [i for i in items if i.get("customer") not in moved] + db_items
    except Exception as ex:  # the vault part still shows; the page names the database failure
        log("task database failed:", ex)
        database = {"ok": False, "error": str(ex)[:200]}
    for i in items:  # the page refreshes its copy of a details page when this changes
        path = details_file(i.get("details")) if i.get("details") else None
        i["detailsAt"] = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(timespec="seconds") if path else None
        if not path:
            i["details"] = None
    mtime = datetime.fromtimestamp(dashboard.stat().st_mtime, timezone.utc)
    return {"vault": dashboard.parent.name, "syncedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "sourceModifiedAt": mtime.isoformat(timespec="seconds"), "items": items, "database": database}


# A task's pull requests: found on GitHub by its tracker key, in its client's organisation.
PR_FIELDS = """number title url state isDraft createdAt updatedAt mergedAt closedAt additions deletions changedFiles
  author { login } repository { nameWithOwner } mergeable mergeStateStatus reviewDecision
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  reviewThreads(first: 100) { nodes { isResolved comments(last: 1) { nodes { author { login } } } } }"""
_prs_cache: dict = {}


def _pr(n: dict) -> dict:
    author = (n.get("author") or {}).get("login")
    threads = [t for t in (n.get("reviewThreads") or {}).get("nodes") or [] if not t.get("isResolved")]
    last = lambda t: (((t.get("comments") or {}).get("nodes") or [{}])[0].get("author") or {}).get("login")
    commit = (((n.get("commits") or {}).get("nodes") or [{}])[0].get("commit") or {})
    return {"repo": n["repository"]["nameWithOwner"], "number": n["number"], "title": n["title"], "url": n["url"],
            "state": "draft" if n.get("isDraft") and n["state"] == "OPEN" else n["state"].lower(),
            "createdAt": n.get("createdAt"), "updatedAt": n.get("updatedAt"), "mergedAt": n.get("mergedAt"),
            "closedAt": n.get("closedAt"), "author": author, "additions": n.get("additions"),
            "deletions": n.get("deletions"), "files": n.get("changedFiles"),
            "conflicts": n.get("mergeable") == "CONFLICTING", "mergeState": n.get("mergeStateStatus"),
            "checks": ((commit.get("statusCheckRollup") or {}).get("state") or "none").lower(),
            "review": (n.get("reviewDecision") or "").lower() or None,
            "unresolved": len(threads), "awaiting": sum(1 for t in threads if last(t) != author)}


PR_REF = re.compile(r"^([\w.-]+)/([\w.-]+)#(\d+)$")


def linked_prs(refs: list) -> dict:
    """The task's own pull requests, as an agent linked them, whatever their state."""
    import subprocess
    refs = [r for r in refs if isinstance(r, str) and PR_REF.match(r)][:30]
    parts = []
    for i, r in enumerate(refs):
        o, n, num = PR_REF.match(r).groups()
        parts.append('p%d: repository(owner: %s, name: %s) { pullRequest(number: %s) { %s } }' % (i, json.dumps(o), json.dumps(n), num, PR_FIELDS))
    run = subprocess.run(["gh", "api", "graphql", "-f", "query={%s}" % " ".join(parts)], capture_output=True, text=True, timeout=25)
    data = (json.loads(run.stdout or "{}").get("data") or {}) if run.stdout else {}
    if run.returncode != 0 and not data:
        raise RuntimeError("GitHub didn't answer: " + (run.stderr.strip().splitlines() or ["gh failed"])[-1][:200])
    prs = [_pr(v["pullRequest"]) for v in data.values() if v and v.get("pullRequest")]
    prs.sort(key=lambda p: (p["state"] not in ("open", "draft"), -(datetime.fromisoformat(p["updatedAt"].replace("Z", "+00:00")).timestamp())))
    return {"prs": prs, "linked": True, "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds")}


def task_prs(args: dict) -> dict:
    """Pull requests for a task: the ones an agent linked to it when there are any; otherwise those naming its
    tracker key in its client's organisation, or the tracker itself when it is a pull request. Open ones first,
    then any merged or closed in the last 30 days."""
    import subprocess
    key, customer = str(args.get("key") or "").strip(), str(args.get("customer") or "")
    linked = [r for r in args.get("linked") or [] if isinstance(r, str)]
    cache_key = (key, customer, tuple(linked))
    hit = _prs_cache.get(cache_key)
    if hit and time.time() - hit[0] < 60:
        return hit[1]
    if linked:
        out = linked_prs(linked)
        _prs_cache[cache_key] = (time.time(), out)
        return out
    m = re.match(r"^([\w.-]+)/([\w.-]+)#(\d+)$", key)
    if m:
        query = 'query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){%s}}}' % PR_FIELDS
        cmd = ["gh", "api", "graphql", "-f", f"query={query}", "-f", f"o={m[1]}", "-f", f"r={m[2]}", "-F", f"n={m[3]}"]
    elif re.match(r"^[A-Z][A-Z0-9]+-\d+$", key) and customer in host_config.clients()["githubOrgs"]:
        query = 'query($q:String!){search(query:$q,type:ISSUE,first:20){nodes{... on PullRequest{%s}}}}' % PR_FIELDS
        cmd = ["gh", "api", "graphql", "-f", f"query={query}", "-f", f'q="{key}" org:{host_config.clients()["githubOrgs"][customer]} is:pr sort:updated-desc']
    else:
        return {"prs": [], "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "note": "no tracker key to search by"}
    run = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
    if run.returncode != 0:
        raise RuntimeError("GitHub didn't answer: " + (run.stderr.strip().splitlines() or ["gh failed"])[-1][:200])
    data = json.loads(run.stdout).get("data") or {}
    nodes = [((data.get("repository") or {}).get("pullRequest"))] if m else (data.get("search") or {}).get("nodes") or []
    cutoff = (datetime.now(timezone.utc).timestamp() - 30 * 86400)
    prs = []
    for n in nodes:
        if not n or "number" not in n:
            continue
        pr = _pr(n)
        ended = pr["mergedAt"] or pr["closedAt"]
        if pr["state"] in ("open", "draft") or (ended and datetime.fromisoformat(ended.replace("Z", "+00:00")).timestamp() > cutoff):
            prs.append(pr)
    prs.sort(key=lambda p: (p["state"] not in ("open", "draft"), -(datetime.fromisoformat(p["updatedAt"].replace("Z", "+00:00")).timestamp())))
    out = {"prs": prs[:10], "linked": False, "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    _prs_cache[cache_key] = (time.time(), out)
    return out


DETAILS_MAX = 120_000  # characters; a store document holds at most 256 KiB of UTF-8


def details_file(rel):
    """The details page at a vault-relative path, or None when it is not a Markdown file inside the vault."""
    from pathlib import Path
    if not isinstance(rel, str) or not rel.endswith(".md") or rel.startswith(("/", "~")) or "\0" in rel:
        return None
    vault = host_config.VAULT_DIR
    path = (vault / rel).resolve()
    return path if path.is_file() and vault in path.parents else None


def details_read(args: dict) -> dict:
    path = details_file(args.get("path"))
    if path is None:
        raise ValueError("no details page at that path")
    text = path.read_text(encoding="utf-8", errors="replace")
    return {"path": args.get("path"), "title": path.stem, "md": text[:DETAILS_MAX], "truncated": len(text) > DETAILS_MAX,
            "modifiedAt": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(timespec="seconds")}


def edit_task(args: dict, action: str) -> dict:
    """Close or move one Dashboard.md item, then return the re-read worklist."""
    from pathlib import Path
    import dashboard_edit
    dashboard = host_config.DASHBOARD
    ref = str(args.get("ref") or "")
    if not ref:
        raise dashboard_edit.EditError("ref is required")
    with _edit_lock:
        import tasks_source
        if ref.startswith(tasks_source.REF_PREFIX):
            tasks_source.act(ref, action, args.get("to"), datetime.now().date())
        else:
            dashboard_edit.apply(dashboard, ref, action, args.get("to"))
        return {"ok": True, "tasks": tasks_doc(dashboard)}


_edit_lock = threading.Lock()


def grade_many(args: dict) -> dict:
    """Grade several task database items, then return what happened and the re-read worklist."""
    from pathlib import Path
    import tasks_source
    grades = args.get("grades")
    if not isinstance(grades, list) or not grades or len(grades) > 200:
        raise ValueError("grades must list 1 to 200 items")
    with _edit_lock:
        result = tasks_source.grade_many(grades)
        return {"ok": True, **result, "tasks": tasks_doc(host_config.DASHBOARD)}


def move_many(args: dict) -> dict:
    """Move several task database items, then return what happened and the re-read worklist."""
    from pathlib import Path
    import tasks_source
    refs, to = args.get("refs"), args.get("to")
    if not isinstance(refs, list) or not refs or len(refs) > 200:
        raise ValueError("refs must list 1 to 200 items")
    with _edit_lock:
        result = tasks_source.act_many(refs, to, datetime.now().date())
        return {"ok": True, **result, "tasks": tasks_doc(host_config.DASHBOARD)}

# ---------- Sync now (the page's Refresh button) ----------
# Runs the same scripts as the scheduled sync and hands the documents to the page, which writes them
# to its own store. Nothing here is tied to a claude.ai account, so it survives an account switch.
MISE = os.path.expanduser("~/.local/bin/mise")
UV_EXEC = [MISE, "exec", "uv@0.11.28", "--", "uv", "run", "--no-project",
           "--with", "icalendar", "--with", "recurring-ical-events", "python"]
_sync_lock = threading.Lock()


def run_script(cmd: list, out_name: str, tmp: str) -> dict:
    """Run one sync script that writes JSON to a file; return {ok, doc} or {ok: False, error}."""
    import subprocess
    out = os.path.join(tmp, out_name)
    try:
        p = subprocess.run(cmd + [out], capture_output=True, text=True, timeout=150, cwd=tmp)
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timed out"}
    if p.returncode != 0 or not os.path.exists(out):
        # stderr may quote a feed URL, so only its last line goes back, with URLs removed
        tail = (p.stderr.strip().splitlines() or ["no output"])[-1]
        log(out_name, "failed:", tail)
        return {"ok": False, "error": re.sub(r"\S+://\S+", "<url>", tail)[:160]}
    with open(out, encoding="utf-8") as f:
        return {"ok": True, "doc": json.load(f)}


def sync_now() -> dict:
    import tempfile
    from pathlib import Path
    if not _sync_lock.acquire(blocking=False):
        raise RuntimeError("a sync is already running")
    try:
        with tempfile.TemporaryDirectory(prefix="dashboard-sync-") as tmp:
            res = {}
            try:
                res["tasks"] = {"ok": True, "doc": tasks_doc(host_config.DASHBOARD)}
            except Exception as ex:
                res["tasks"] = {"ok": False, "error": str(ex)[:160]}
            with ThreadPoolExecutor(max_workers=2) as pool:
                ev = pool.submit(run_script, UV_EXEC + [os.path.join(HERE, "sync_events.py"), str(host_config.config_file("feeds.json"))], "events.json", tmp)
                jr = pool.submit(run_script, [sys.executable, os.path.join(HERE, "sync_jira.py"), str(host_config.config_file("jira.json"))], "jira.json", tmp)
                res["events"], res["jira"] = ev.result(), jr.result()
        return res
    finally:
        _sync_lock.release()

# ---------- Commander (Mac mini) requests ----------
# The page never sees the endpoint or token: both live in commander.json in the configuration folder.
STATES = {"received", "asked", "answered", "dispatched", "waiting", "done", "failed"}
REQ_ID = re.compile(r"^dash-[A-Za-z0-9-]{8,64}$")
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$")


def commander_http(method: str, path: str, body: dict | None = None):
    from pathlib import Path
    conf = host_config.config_file("commander.json")
    if not conf.exists():
        raise RuntimeError("commander.json isn't in _Dashboard Sync yet")
    d = json.loads(conf.read_text(encoding="utf-8"))
    url, token = str(d.get("url") or "").rstrip("/"), str(d.get("token") or "")
    if not url.startswith(("http://", "https://")) or not token:
        raise RuntimeError("commander.json needs a url and a token")
    req = urllib.request.Request(url + path, method=method,
                                 data=json.dumps(body).encode("utf-8") if body is not None else None,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json",
                                          "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as ex:  # never echo the request: it carries the token
        raise RuntimeError(f"Commander answered HTTP {ex.code}") from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RuntimeError("Commander didn't answer; is the Mac mini awake and on the tailnet?") from None
    except ValueError:
        raise RuntimeError("Commander's answer wasn't JSON") from None


def commander_record(x) -> dict | None:
    """Only the fields the page shows, cleaned."""
    if not isinstance(x, dict) or not REQ_ID.match(str(x.get("id") or "")):
        return None
    state = str(x.get("state") or "received")
    action = x.get("action") if x.get("action") in ("status", "execute", "plan", "answer") else "status"
    return {"id": str(x["id"]), "action": action,
            "state": state if state in STATES else "received",
            "summary": " ".join(str(x.get("summary") or "").split())[:300],
            "worker": str(x["worker"])[:80] if x.get("worker") else None,
            "updatedAt": str(x.get("updatedAt") or "")[:40] or None,
            "options": ask_options(x.get("options"))}


def ask_options(raw) -> list | None:
    """Up to four answer options for an ask, AskUserQuestion style: {label, description?, recommended?}."""
    if not isinstance(raw, list):
        return None
    out = []
    for o in raw[:4]:
        if not isinstance(o, dict) or not str(o.get("label") or "").strip():
            continue
        item = {"label": " ".join(str(o["label"]).split())[:80]}
        if o.get("description"):
            item["description"] = " ".join(str(o["description"]).split())[:300]
        if o.get("recommended") is True:
            item["recommended"] = True
        out.append(item)
    return out or None


def relay_item(x) -> dict:
    if not isinstance(x, dict):
        raise ValueError("the queued request has no item")
    customer = str(x.get("customer") or "")
    if customer not in host_config.clients()["names"]:
        raise ValueError("unknown client")
    link = str(x.get("link") or "")
    title = " ".join(str(x.get("title") or "").split())[:300]
    if not title or (link and not link.startswith("https://")):
        raise ValueError("the queued item needs a title, and its link must be https")
    band = x.get("band") if x.get("band") in ("today", "tomorrow", "future", "unscheduled") else None
    return {"customer": customer, "title": title, "key": str(x.get("key") or "")[:60] or None, "link": link or None,
            "band": band, "day": str(x.get("day") or "")[:40] or None, "done": False}


def commander_send(args: dict) -> dict:
    from pathlib import Path
    action, ref = args.get("action"), str(args.get("ref") or "")
    if action not in ("status", "execute"):
        raise ValueError("action must be status or execute")
    rid = str(args.get("id") or "")
    if not REQ_ID.match(rid):
        rid = f"dash-{uuid.uuid4()}"
    if RELAY_ONLY:
        # The relay has no Dashboard.md, so it sends the item as the page queued it.
        item = relay_item(args.get("item"))
    else:
        # Send only items that are on the dashboard right now, with their current text.
        doc = tasks_doc(host_config.DASHBOARD)
        item = next((i for i in doc["items"] if i.get("ref") == ref and not i.get("meeting")), None)
    if item is None:
        raise ValueError("that item isn't in Dashboard.md as synced; it may have been edited. Refresh and try again")
    if item.get("done"):
        raise ValueError("that item is already ticked in Dashboard.md")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    body = {"id": rid, "action": action, "client": host_config.clients()["names"].get(item.get("customer"), "Other"),
            "title": item.get("title"), "key": item.get("key"), "link": item.get("link"), "band": item.get("band"),
            "day": item.get("day"), "ref": ref, "requestedAt": now}
    rec = commander_record(commander_http("POST", "/requests", body)) or {}
    out = {"id": rid, "action": action, "state": "received", "summary": "", "worker": None, "updatedAt": now}
    out.update({k: v for k, v in rec.items() if v not in (None, "")})
    out.update(ref=ref, title=item.get("title"), requestedAt=now)
    return {"ok": True, "request": out}


ASK_KINDS = ("task", "commander", "question")
ANSWER_REF = re.compile(r"^(db:[a-z0-9][a-z0-9-]{0,127}|ask:(task|commander|question):[A-Za-z0-9:._-]{1,128})$")


def commander_answer(args: dict) -> dict:
    """Tobias's answer to a Waiting on you ask, from the sidebar: a chosen option, free text, or both.
    Sent to Commander as an "answer" request; no Dashboard.md lookup, since it answers an ask, not an item."""
    clean = lambda v, n: " ".join(str(v or "").split())[:n]
    ask, answer = args.get("ask"), args.get("answer")
    if not isinstance(ask, dict) or ask.get("kind") not in ASK_KINDS:
        raise ValueError("ask.kind must be task, commander or question")
    if not isinstance(answer, dict):
        raise ValueError("answer must be an object with choice, text or both")
    choice = clean(answer.get("choice"), 80)
    text = str(answer.get("text") or "").strip()[:2000]
    if not choice and not text:
        raise ValueError("answer needs a choice or text")
    ref = str(args.get("ref") or "")
    if not ANSWER_REF.match(ref):
        raise ValueError("ref must be db:<task id> or ask:<kind>:<id>")
    rid = str(args.get("id") or "")
    if not REQ_ID.match(rid):
        rid = f"dash-{uuid.uuid4()}"
    sent_ask = {"kind": ask["kind"], "ask": clean(ask.get("ask"), 300)}
    for key, n in (("id", 80), ("ref", 140), ("worker", 80), ("customer", 40), ("title", 300)):
        if ask.get(key):
            sent_ask[key] = clean(ask[key], n)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    sent_answer = {k: v for k, v in (("choice", choice), ("text", text)) if v}
    if answer.get("always") is True:
        sent_answer["always"] = True
    body = {"id": rid, "action": "answer", "ref": ref, "ask": sent_ask,
            "answer": sent_answer, "requestedAt": now}
    rec = commander_record(commander_http("POST", "/requests", body)) or {}
    out = {"id": rid, "action": "answer", "state": "received", "summary": "", "worker": None, "updatedAt": now}
    out.update({k: v for k, v in rec.items() if v not in (None, "")})
    out.update(ref=ref, requestedAt=now)
    result = {"ok": True, "request": out}
    if ask["kind"] == "task" and ref.startswith("db:"):
        warning = clear_answered_task(ref[3:], rid, choice or text)
        if warning:
            result["warning"] = warning
    return result


def clear_answered_task(task_id: str, rid: str, said: str) -> str | None:
    """Unblock a task once Tobias has answered its ask, so it leaves Waiting on you. The answer still
    reaches the agent through Commander. A stale revision is read again once. Returns a warning or None."""
    import tasks_source
    conf = tasks_source.config()
    if conf is None:
        return "answer sent, but the task stays blocked: tasks.json isn't set up"
    note = " ".join(f"Tobias answered {rid}: {said}".split())[:160]
    for attempt in (1, 2):
        try:
            current = tasks_source.call(conf, "task_get", {"id": task_id}) or {}
            if not current.get("blocked"):
                return None
            tasks_source.call(conf, "task_update", {
                "by": conf.get("by") or "Dashboard", "id": task_id, "revision": current["revision"],
                "blocked": False, "blockedOn": None, "note": note, **tasks_source._owner_force(current)})
            return None
        except Exception as ex:
            if attempt == 2 or "revision" not in str(ex).lower():
                return f"answer sent, but the task stays blocked: {str(ex)[:120]}"
    return None


TRACKERS = {"monday": re.compile(r"^ADX-\d{3,20}$"), "jira": re.compile(r"^[A-Z][A-Z0-9]+-\d+$"),
            "github": re.compile(r"^[\w.-]+/[\w.-]+#\d+$|^#\d+$")}


def commander_plan(args: dict) -> dict:
    """Ask Commander to plan a tracker item that has no task yet: route it to the right agent, add it to the
    task database with a details page, a test plan and its priority, or refuse it with the reason. With a ref
    instead, plan an existing worklist item that has no details page: write the page and link it."""
    if args.get("ref"):
        return commander_plan_item(args)
    system, key = str(args.get("system") or ""), str(args.get("key") or "")
    if system not in TRACKERS or not TRACKERS[system].match(key):
        raise ValueError("system must be monday, jira or github, with a key in that tracker's form")
    customer = str(args.get("customer") or "")
    if customer not in host_config.clients()["names"]:
        raise ValueError("unknown client")
    url = str(args.get("url") or "")
    if url and not url.startswith("https://"):
        raise ValueError("url must be https")
    rid = str(args.get("id") or "")
    if not REQ_ID.match(rid):
        rid = f"dash-{uuid.uuid4()}"
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    title = " ".join(str(args.get("title") or "").split())[:300]
    body = {"id": rid, "action": "plan", "client": host_config.clients()["names"][customer], "title": title,
            "key": key, "link": url or None, "ref": f"{system}:{key}", "requestedAt": now,
            "source": {"system": system, "key": key, "url": url or None,
                       "status": str(args.get("status") or "")[:60] or None,
                       "priority": str(args.get("priority") or "")[:30] or None}}
    rec = commander_record(commander_http("POST", "/requests", body)) or {}
    out = {"id": rid, "action": "plan", "state": "received", "summary": "", "worker": None, "updatedAt": now}
    out.update({k: v for k, v in rec.items() if v not in (None, "")})
    out.update(ref=f"{system}:{key}", title=title, requestedAt=now)
    return {"ok": True, "request": out}


def commander_plan_item(args: dict) -> dict:
    from pathlib import Path
    ref = str(args.get("ref") or "")
    rid = str(args.get("id") or "")
    if not REQ_ID.match(rid):
        rid = f"dash-{uuid.uuid4()}"
    if RELAY_ONLY:
        item = relay_item(args.get("item"))
    else:
        doc = tasks_doc(host_config.DASHBOARD)
        item = next((i for i in doc["items"] if i.get("ref") == ref and not i.get("meeting")), None)
    if item is None:
        raise ValueError("that item isn't in the worklist as synced; it may have changed. Refresh and try again")
    if item.get("done"):
        raise ValueError("that item is already done")
    if item.get("details"):
        raise ValueError("that item already has a details page")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    body = {"id": rid, "action": "plan", "client": host_config.clients()["names"].get(item.get("customer"), "Other"),
            "title": item.get("title"), "key": item.get("key"), "link": item.get("link"), "band": item.get("band"),
            "day": item.get("day"), "ref": ref, "requestedAt": now, "source": None}
    rec = commander_record(commander_http("POST", "/requests", body)) or {}
    out = {"id": rid, "action": "plan", "state": "received", "summary": "", "worker": None, "updatedAt": now}
    out.update({k: v for k, v in rec.items() if v not in (None, "")})
    out.update(ref=ref, title=item.get("title"), requestedAt=now)
    return {"ok": True, "request": out}


def commander_requests(args: dict) -> dict:
    since = str(args.get("since") or "")
    if since and not ISO.match(since):
        raise ValueError("since must be an ISO time")
    res = commander_http("GET", "/requests" + (f"?since={urllib.parse.quote(since)}" if since else ""))
    rows = res if isinstance(res, list) else (res or {}).get("requests") or (res or {}).get("items") or []
    return {"items": [r for r in map(commander_record, rows) if r]}


# Waiting on you. A blocked task waits on Tobias when its waitingFor starts with his name (the person
# who must act comes first: "Tobias: which support system ..."). A Commander request waits on him when
# it is "asked", or "waiting" with a summary that puts him next to act ("Blocked: Tobias to name ...").
WAITS_ON_ME = re.compile(r"^\s*(tobias|you)\b", re.I)
ASKS_ME = re.compile(r"\btobias\s*(to\b|:)", re.I)


def waiting_on_you(args: dict) -> dict:
    """Questions and decisions that wait on Tobias, from the task database and Commander. Read-only."""
    import tasks_source
    conf = tasks_source.config()
    items, errors = [], []
    # The latest answer Tobias gave per task ref, so a task answered since it was blocked is not listed
    # again while its block waits to be cleared.
    answered = {}
    try:
        raw = commander_http("GET", "/requests")
        rows = raw if isinstance(raw, list) else (raw or {}).get("requests") or (raw or {}).get("items") or []
        for r in rows:
            if isinstance(r, dict) and r.get("action") == "answer" and str(r.get("ref") or "").startswith("db:"):
                at = str(r.get("requestedAt") or r.get("updatedAt") or "")[:10]
                answered[r["ref"]] = max(at, answered.get(r["ref"], ""))
    except Exception as ex:
        errors.append(f"answers: {str(ex)[:120]}")
    if conf:
        for client_id, customer in conf["clients"].items():
            try:
                found = tasks_source.call(conf, "task_search", {"clientId": client_id, "blocked": True, "limit": 200})
                for s in (found or {}).get("items", []):
                    full = tasks_source.call(conf, "task_get", {"id": s["id"]}) or {}
                    b = full.get("blockedOn") or {}
                    ask = " ".join(str(b.get("waitingFor") or "").split())
                    since = str(b.get("since") or "")[:10]
                    last = answered.get(tasks_source.REF_PREFIX + s["id"], "")
                    if WAITS_ON_ME.match(ask) and not (last and since and last >= since):
                        items.append({"kind": "task", "ref": tasks_source.REF_PREFIX + s["id"], "customer": customer,
                                      "title": full.get("title") or s.get("title"), "ask": ask[:300],
                                      "reason": " ".join(str(b.get("reason") or "").split())[:300] or None,
                                      "detail": " ".join(str(full.get("summary") or "").split())[:1000] or None,
                                      "since": b.get("since")})
            except Exception as ex:
                errors.append(f"{client_id}: {str(ex)[:120]}")
    # A Commander request that repeats a task's question (three or more shared words of six letters
    # or more, such as "Helsingborg's support system") is the same ask, so only the task is kept.
    words = lambda t: {w.lower().strip(".,:;()'s") for w in re.findall(r"[A-Za-zÅÄÖåäö']{6,}", t or "")} - {"tobias"}
    asked = [words(i["ask"]) for i in items]
    try:
        for r in commander_requests({}).get("items", []):
            if r["state"] == "asked" or (r["state"] == "waiting" and ASKS_ME.search(r["summary"])):
                if any(len(words(r["summary"]) & a) >= 3 for a in asked):
                    continue
                item = {"kind": "commander", "id": r["id"], "worker": r["worker"], "ask": r["summary"],
                        "since": (r["updatedAt"] or "")[:10] or None}
                if r.get("options"):
                    item["options"] = r["options"]
                items.append(item)
    except Exception as ex:
        errors.append(f"commander: {str(ex)[:120]}")
    # Commander's own pending questions (GET /questions, oldest first, text cut at 300 characters).
    try:
        for q in commander_http("GET", "/questions") or []:
            text = " ".join(str(q.get("question") or "").split()) if isinstance(q, dict) else ""
            if text:
                item = {"kind": "question", "id": str(q.get("id") or "")[:80], "worker": str(q.get("worker") or "Commander")[:80],
                        "ask": text[:300], "since": str(q.get("askedAt") or "")[:10] or None}
                options = ask_options(q.get("options"))
                if options:
                    item["options"] = options
                items.append(item)
    except Exception as ex:
        errors.append(f"questions: {str(ex)[:120]}")
    items.sort(key=lambda i: i.get("since") or "")
    return {"items": items, "errors": errors}


def host_stats(args: dict) -> dict:
    """host_stat_list from the tasks server, with each host's client mapped to the page's customer key."""
    import tasks_source
    conf = tasks_source.config()
    if conf is None:
        raise RuntimeError("tasks.json isn't in _Dashboard Sync")
    query = {}
    for key in ("host", "from", "to"):
        value = str(args.get(key) or "")
        if value:
            if key != "host" and not ISO.match(value):
                raise ValueError(f"{key} must be an ISO time")
            query[key] = value
    result = tasks_source.call(conf, "host_stat_list", query)
    for h in result.get("hosts") or []:
        h["customer"] = conf["clients"].get(h.get("clientId"), "other")
    return result

TOOLS = [{
    "name": "release_status",
    "title": "Release status",
    "description": "Which release-matrix repositories have drifted: development not on main's head, or "
                   "staging/production not on the release head (or deploying, failed, never deployed). Per repository "
                   "the state of each environment (ok, behind, deploying, failed, none) and the reasons, plus the "
                   "count of synced repositories. Read-only.",
    "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    "annotations": {"readOnlyHint": True, "openWorldHint": True},
}, {
    "name": "task_done",
    "title": "Mark a dashboard item done",
    "description": "Tick one Dashboard.md item, addressed by its ref from the worklist sync. "
                   "Snapshots the file first and refuses on a conflict copy or a changed line. Returns the new worklist.",
    "inputSchema": {"type": "object", "properties": {"ref": {"type": "string"}}, "required": ["ref"], "additionalProperties": False},
    "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
}, {
    "name": "task_move",
    "title": "Move a dashboard item",
    "description": "Move one Dashboard.md item to today, tomorrow or the backlog (Unscheduled), under the same client. "
                   "Snapshots the file first and refuses on a conflict copy or a changed line. Returns the new worklist.",
    "inputSchema": {"type": "object", "properties": {"ref": {"type": "string"}, "to": {"type": "string", "enum": ["today", "tomorrow", "backlog"]}},
                    "required": ["ref", "to"], "additionalProperties": False},
    "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
}, {
    "name": "task_move_many",
    "title": "Move several task database items",
    "description": "Move task database items (refs starting db:) to today, tomorrow or the backlog in one call. "
                   "Skips items in progress, in review, claimed by a session, blocked or closed. Returns what moved, "
                   "what was skipped and why, and the new worklist.",
    "inputSchema": {"type": "object", "properties": {
        "refs": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 200},
        "to": {"type": "string", "enum": ["today", "tomorrow", "backlog"]}},
        "required": ["refs", "to"], "additionalProperties": False},
    "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True},
}, {
    "name": "task_grade_many",
    "title": "Grade several task database items",
    "description": "Set business value and effort on task database items (refs starting db:), so each gets a Covey "
                   "quadrant. Returns what was graded, what was skipped and why, and the new worklist.",
    "inputSchema": {"type": "object", "properties": {"grades": {"type": "array", "minItems": 1, "maxItems": 200, "items": {
        "type": "object", "properties": {
            "ref": {"type": "string"},
            "value": {"type": "string", "enum": ["negative", "none", "low", "medium", "high", "veryHigh"]},
            "effort": {"type": "string", "enum": ["XS", "S", "M", "L", "XL"]}},
        "required": ["ref", "value", "effort"], "additionalProperties": False}}},
        "required": ["grades"], "additionalProperties": False},
    "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True},
}, {
    "name": "task_assess",
    "title": "Set a task's value, effort and due date",
    "description": "Set or clear (null) business value, effort and due date on one task database item (ref starting db:). "
                   "Value and effort decide its Covey quadrant; a due date makes it urgent. Returns the new worklist.",
    "inputSchema": {"type": "object", "properties": {
        "ref": {"type": "string"},
        "value": {"type": ["string", "null"], "enum": ["negative", "none", "low", "medium", "high", "veryHigh", None]},
        "effort": {"type": ["string", "null"], "enum": ["XS", "S", "M", "L", "XL", None]},
        "due": {"type": ["string", "null"], "pattern": "^\\d{4}-\\d{2}-\\d{2}$"}},
        "required": ["ref"], "additionalProperties": False},
    "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True},
}, {
    "name": "commander_send",
    "title": "Ask Commander about a dashboard item",
    "description": "Send one Dashboard.md item (by ref) to the Commander session on the Mac mini: action 'status' asks its "
                   "owner where it stands, 'execute' dispatches it. The item's text comes from Dashboard.md, not the caller. "
                   "Returns the stored request record.",
    "inputSchema": {"type": "object", "properties": {"ref": {"type": "string"}, "action": {"type": "string", "enum": ["status", "execute"]},
                    "id": {"type": "string", "description": "dash-<uuid>; the same id twice is one request"},
                    "item": {"type": "object", "description": "the item as the page saw it; read only in relay mode"}},
                    "required": ["ref", "action"], "additionalProperties": False},
    "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": True},
}, {
    "name": "commander_plan",
    "title": "Ask Commander to plan a tracker item",
    "description": "Send a tracker item that has no task yet (Monday, Jira or GitHub) to Commander, which routes it to the right "
                   "agent and adds it to the task database with a details page, a test plan and its priority, or refuses it "
                   "as obsolete, redundant or too thin to plan. Returns the stored request record; its ref is <system>:<key>. "
                   "With ref instead of system and key, plan an existing worklist item that has no details page.",
    "inputSchema": {"type": "object", "properties": {
        "system": {"type": "string", "enum": ["monday", "jira", "github"]}, "key": {"type": "string"},
        "customer": {"type": "string"}, "title": {"type": "string"}, "url": {"type": "string"},
        "status": {"type": "string"}, "priority": {"type": "string"},
        "ref": {"type": "string", "description": "a worklist item's ref, to plan that item"},
        "item": {"type": "object", "description": "the item as the page saw it; read only in relay mode"},
        "id": {"type": "string", "description": "dash-<uuid>; the same id twice is one request"}},
        "additionalProperties": False},
    "annotations": {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": True},
}, {
    "name": "commander_requests",
    "title": "Commander request states",
    "description": "Dashboard requests Commander changed since a time (ISO), newest first: id, action, state, one-line summary, worker.",
    "inputSchema": {"type": "object", "properties": {"since": {"type": "string"}}, "additionalProperties": False},
    "annotations": {"readOnlyHint": True, "openWorldHint": True},
}, {
    "name": "worklist",
    "title": "The worklist, live",
    "description": "The worklist now: Dashboard.md, with the clients named in tasks.json read from the task database "
                   "instead. Same document as sync_now's tasks, plus database: {ok, clients} or {ok: false, error}. "
                   "Changes nothing.",
    "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    "annotations": {"readOnlyHint": True, "openWorldHint": True},
}, {
    "name": "details_read",
    "title": "Read a details page",
    "description": "Read one task's details page from the vault, by the vault-relative path the worklist gives as an "
                   "item's details. Returns {path, title, md, truncated, modifiedAt}. Changes nothing.",
    "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"], "additionalProperties": False},
    "annotations": {"readOnlyHint": True},
}, {
    "name": "task_prs",
    "title": "A task's pull requests",
    "description": "The pull requests for a task: the ones linked to it (linked, owner/repo#number) when given; otherwise those "
                   "naming its tracker key in its client's GitHub organisation, or the tracker itself when it is a pull "
                   "request. Each with state, author, size, merge conflicts, CI result, review decision and unresolved "
                   "review threads; linked says which way they were found. Changes nothing.",
    "inputSchema": {"type": "object", "properties": {"key": {"type": "string"}, "customer": {"type": "string"},
                    "linked": {"type": "array", "items": {"type": "string"}}},
                    "additionalProperties": False},
    "annotations": {"readOnlyHint": True, "openWorldHint": True},
}, {
    "name": "host_stats",
    "title": "Host statistics",
    "description": "CPU, load, free memory, swap, free disk and busy runners per host, from the task database: "
                   "{hosts: [{clientId, customer, host, lastSeen, latest, samples, breaches}], breachCount: {warn, crit}}. "
                   "Defaults to the last 24 hours; from and to are ISO times. Changes nothing.",
    "inputSchema": {"type": "object", "properties": {"host": {"type": "string"}, "from": {"type": "string"},
                    "to": {"type": "string"}}, "additionalProperties": False},
    "annotations": {"readOnlyHint": True, "openWorldHint": True},
}, {
    "name": "commander_answer",
    "title": "Answer an ask",
    "description": "Send Tobias's answer to a Waiting on you ask to Commander, as an 'answer' request: a chosen option, "
                   "free text, or both. Args: id (dash-<uuid>, generated when absent), ref (db:<task id> or "
                   "ask:<kind>:<id>), ask {kind: task|commander|question, id?, ref?, worker?, customer?, ask, title?}, "
                   "answer {choice? (an option's label, 80 chars), text? (2000 chars), always? (true applies the "
                   "answer to all future requests of the same kind)}. Returns {request} in the "
                   "commander_send shape.",
    "inputSchema": {"type": "object", "properties": {
        "id": {"type": "string"}, "ref": {"type": "string"},
        "ask": {"type": "object", "properties": {"kind": {"type": "string", "enum": list(ASK_KINDS)},
                "id": {"type": "string"}, "ref": {"type": "string"}, "worker": {"type": "string"},
                "customer": {"type": "string"}, "ask": {"type": "string"}, "title": {"type": "string"}},
                "required": ["kind", "ask"]},
        "answer": {"type": "object", "properties": {"choice": {"type": "string"}, "text": {"type": "string"},
                   "always": {"type": "boolean"}}}},
        "required": ["ref", "ask", "answer"], "additionalProperties": False},
    "annotations": {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True},
}, {
    "name": "waiting_on_you",
    "title": "Waiting on you",
    "description": "Questions and decisions that wait on Tobias: blocked tasks whose waitingFor starts with his name, "
                   "Commander requests that ask him, and Commander's pending questions. "
                   "{items: [{kind: task|commander|question, ref|id, customer|worker, title, "
                   "ask, reason, detail?, since, options?}], errors}. detail is a task's summary (1000 chars), the "
                   "context for judging the ask. options is on commander and question items that offer "
                   "choices: [{label, description?, recommended?}], at most 4. Oldest first. Changes nothing.",
    "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    "annotations": {"readOnlyHint": True, "openWorldHint": True},
}, {
    "name": "sync_now",
    "title": "Sync the dashboard now",
    "description": "Read Dashboard.md, the calendar feeds and Jira now, the same as the scheduled sync. Returns "
                   "{tasks, events, jira}, each {ok, doc} or {ok: false, error}; the caller stores the docs. "
                   "Changes nothing on disk.",
    "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    "annotations": {"readOnlyHint": True, "openWorldHint": True},
}]


def handle(msg: dict):
    method, mid = msg.get("method"), msg.get("id")
    if method == "initialize":
        ver = (msg.get("params") or {}).get("protocolVersion") or "2025-06-18"
        return {"protocolVersion": ver, "capabilities": {"tools": {}},
                "serverInfo": {"name": "dashboard", "version": "1.0.0"}}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": [t for t in TOOLS if t["name"] in RELAY_TOOLS] if RELAY_ONLY else TOOLS}
    if method == "tools/call":
        params = msg.get("params") or {}
        name = params.get("name")
        if RELAY_ONLY and name not in RELAY_TOOLS:
            return {"content": [{"type": "text", "text": "this server only relays to Commander"}], "isError": True}
        if name in ("task_done", "task_move"):
            try:
                result = edit_task(params.get("arguments") or {}, "done" if name == "task_done" else "move")
                return {"content": [{"type": "text", "text": json.dumps({"ok": True})}], "structuredContent": result, "isError": False}
            except Exception as ex:
                log(name, "failed:", ex)
                return {"content": [{"type": "text", "text": str(ex)[:300]}], "isError": True}
        if name == "task_assess":
            try:
                args = params.get("arguments") or {}
                from pathlib import Path
                import tasks_source
                with _edit_lock:
                    tasks_source.assess_one(args.get("ref"), {k: args[k] for k in ("value", "effort", "due") if k in args})
                    result = {"ok": True, "tasks": tasks_doc(host_config.DASHBOARD)}
                return {"content": [{"type": "text", "text": json.dumps({"ok": True})}], "structuredContent": result, "isError": False}
            except Exception as ex:
                log(name, "failed:", ex)
                return {"content": [{"type": "text", "text": str(ex)[:300]}], "isError": True}
        if name in ("task_move_many", "task_grade_many"):
            try:
                result = (move_many if name == "task_move_many" else grade_many)(params.get("arguments") or {})
                done = result.get("moved", result.get("graded", []))
                return {"content": [{"type": "text", "text": json.dumps({"changed": len(done), "skipped": result["skipped"]})}],
                        "structuredContent": result, "isError": False}
            except Exception as ex:
                log(name, "failed:", ex)
                return {"content": [{"type": "text", "text": str(ex)[:300]}], "isError": True}
        if name in ("commander_send", "commander_requests", "commander_plan", "details_read", "task_prs", "host_stats",
                    "waiting_on_you", "commander_answer"):
            try:
                fn = {"commander_send": commander_send, "commander_requests": commander_requests,
                      "commander_plan": commander_plan, "details_read": details_read, "task_prs": task_prs,
                      "host_stats": host_stats, "waiting_on_you": waiting_on_you, "commander_answer": commander_answer}[name]
                result = fn(params.get("arguments") or {})
                return {"content": [{"type": "text", "text": json.dumps(result)}], "structuredContent": result, "isError": False}
            except Exception as ex:
                log(name, "failed:", ex)
                return {"content": [{"type": "text", "text": str(ex)[:300]}], "isError": True}
        if name == "worklist":
            try:
                from pathlib import Path
                result = tasks_doc(host_config.DASHBOARD)
                text = json.dumps({"items": len(result["items"]), "database": result["database"]})
                return {"content": [{"type": "text", "text": text}], "structuredContent": result, "isError": False}
            except Exception as ex:
                log(name, "failed:", ex)
                return {"content": [{"type": "text", "text": str(ex)[:300]}], "isError": True}
        if name == "sync_now":
            try:
                result = sync_now()
                text = json.dumps({k: (v["ok"] if v["ok"] else v["error"]) for k, v in result.items()})
                return {"content": [{"type": "text", "text": text}], "structuredContent": result, "isError": False}
            except Exception as ex:
                log(name, "failed:", ex)
                return {"content": [{"type": "text", "text": str(ex)[:300]}], "isError": True}
        if name != "release_status":
            raise LookupError(f"unknown tool {name}")
        try:
            report = cached_report()
            return {"content": [{"type": "text", "text": json.dumps(report)}], "structuredContent": report, "isError": False}
        except Exception as ex:
            log("release_status failed:", ex)
            return {"content": [{"type": "text", "text": f"Release check failed: {str(ex)[:300]}"}], "isError": True}
    if mid is None:
        return None  # notification
    raise LookupError(f"method not found: {method}")


def send(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def serve():
    out_lock = threading.Lock()

    def work(msg):
        mid = msg.get("id")
        try:
            result = handle(msg)
            if mid is not None:
                with out_lock:
                    send({"jsonrpc": "2.0", "id": mid, "result": result})
        except LookupError as ex:
            if mid is not None:
                with out_lock:
                    send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": str(ex)}})
        except Exception as ex:
            if mid is not None:
                with out_lock:
                    send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32603, "message": str(ex)[:300]}})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        # tool calls can take a while; answer them on a thread so pings still get through
        if msg.get("method") == "tools/call":
            threading.Thread(target=work, args=(msg,), daemon=True).start()
        else:
            work(msg)


if __name__ == "__main__":
    serve()
