#!/usr/bin/env python3
"""Close or move one Dashboard.md item, following the Obsidian plugin's write protocol.

Guard (refuse on an iCloud conflict copy, snapshot outside the vault, prune after
14 days), the smallest edit matched on the exact line, then re-read to verify.
Items are addressed by `ref`, the hash sync_tasks.py gives each line, so an item
edited since the last sync is refused rather than guessed at.
"""
from __future__ import annotations

import datetime as dt
import glob
import os
import re
import shutil
import time
from pathlib import Path

import sync_tasks

PREFIX = re.compile(r"^(?:>\s?)*")
ITEM = re.compile(r"^\s*- \[( |x|X)\]\s+")
SNAPSHOTS = Path.home() / ".claude" / "dashboard-snapshots"
UNSCHEDULED = "### Unscheduled — no day assigned"


class EditError(Exception):
    pass


def content(raw: str) -> str:
    return re.sub(r"^(?:>\s?)+", "", raw).rstrip()


def guard(dashboard: Path) -> Path:
    conflicts = [p for p in glob.glob(str(dashboard.parent / "Dashboard *.md")) if Path(p) != dashboard]
    if conflicts:
        raise EditError("an iCloud conflict copy of Dashboard.md exists; resolve it in Obsidian first")
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    snap = SNAPSHOTS / f"Dashboard-{dt.datetime.now():%Y%m%d-%H%M%S}.md"
    shutil.copy2(dashboard, snap)
    cutoff = time.time() - 14 * 86400
    for old in SNAPSHOTS.glob("Dashboard-*.md"):
        if old.stat().st_mtime < cutoff:
            old.unlink()
    return snap


def scan(lines: list[str]) -> list[dict]:
    """One record per line inside ## Focus: band, day heading index, client heading text."""
    out, band, day, client, started, focus = [], None, None, None, False, False
    for i, raw in enumerate(lines):
        line = content(raw)
        if raw.startswith("## "):
            if focus and started:
                break
            focus = raw.strip() == "## Focus"
            continue
        if not focus:
            continue
        if re.match(r"^\[!note\]-\s*Tomorrow", line):
            band, day, client = "tomorrow", None, None
            out.append({"i": i, "kind": "band", "band": band}); continue
        if re.match(r"^\[!note\]-\s*Future", line):
            band, day, client = "future", None, None
            out.append({"i": i, "kind": "band", "band": band}); continue
        if line.startswith("### "):
            started = True
            if band is None:
                band = "today"
            if line.lower().startswith("### unscheduled"):
                band = "backlog"
            day, client = i, None
            out.append({"i": i, "kind": "day", "band": band}); continue
        if not started:
            continue
        m = re.match(r"^####\s+(.+?)\s*$", line)
        if m:
            client = m.group(1)
            out.append({"i": i, "kind": "client", "band": band, "day": day, "client": client}); continue
        if ITEM.match(line):
            out.append({"i": i, "kind": "item", "band": band, "day": day, "client": client,
                        "ref": sync_tasks.line_ref(line), "done": ITEM.match(line).group(1) != " "})
    return out


def find(lines, recs, ref):
    hits = [r for r in recs if r["kind"] == "item" and r["ref"] == ref]
    if not hits:
        raise EditError("that item changed or moved since the last sync; refresh and try again")
    if len(hits) > 1:
        raise EditError("two identical lines match that item; edit it in Obsidian instead")
    return hits[0]


def block_end(lines, i):
    """An item plus its indented continuation lines."""
    j = i + 1
    while j < len(lines) and content(lines[j]).startswith(("  ", "\t")) and content(lines[j]).strip():
        j += 1
    return j


def next_working_day(today: dt.date) -> dt.date:
    d = today + dt.timedelta(days=1)
    while d.weekday() >= 5:
        d += dt.timedelta(days=1)
    return d


def target_day(lines, recs, to, today):
    """Index of the target day heading, creating Tomorrow's day or the Unscheduled section if missing."""
    days = [r for r in recs if r["kind"] == "day" and r["band"] == to]
    if days:
        return days[0]["i"], lines
    bands = {r["band"]: r["i"] for r in recs if r["kind"] == "band"}
    if to == "today":
        raise EditError("there is no today section in Dashboard.md")
    if to == "tomorrow":
        if "tomorrow" not in bands:
            raise EditError("there is no Tomorrow callout; let /planner create it first")
        d = next_working_day(today)
        at = bands["tomorrow"] + 1
        new = [">", f"> ### {d:%A} {d.day} {d:%B}"]
    else:  # backlog: end of the Future callout
        if "future" not in bands:
            raise EditError("there is no Future callout to hold the backlog")
        at = bands["future"] + 1
        while at < len(lines) and lines[at].startswith(">"):
            at += 1
        new = [">", "> " + UNSCHEDULED]
    lines = lines[:at] + new + lines[at:]
    return at + len(new) - 1, lines


def insert_item(lines, day_i, client, item_lines, prefix):
    """Put the item at the end of the client's open items in that day, creating the group if needed."""
    blank = prefix.rstrip() if prefix else ""
    # Day span: until the next day/band heading or the end of the callout or section.
    end = day_i + 1
    while end < len(lines):
        c = content(lines[end])
        if c.startswith(("### ", "## ")) or lines[end].startswith("## ") or re.match(r"^\[!note\]-", c) \
                or (prefix and not lines[end].startswith(">")) or (not prefix and lines[end].startswith("> [!note]-")):
            break
        end += 1
    group = None
    for k in range(day_i + 1, end):
        if content(lines[k]) == f"#### {client}":
            group = k
            break
    if group is None:
        at = end
        while at - 1 > day_i and not content(lines[at - 1]).strip():
            at -= 1
        new = [blank, f"{prefix}#### {client}", blank] + item_lines
        return lines[:at] + new + lines[at:]
    gend = group + 1
    while gend < end and not content(lines[gend]).startswith(("#### ", "### ")):
        gend += 1
    last_open, first_done = None, None
    for k in range(group + 1, gend):
        m = ITEM.match(content(lines[k]))
        if m and m.group(1) == " ":
            last_open = block_end(lines, k)
        elif m and first_done is None:
            first_done = k
    at = last_open if last_open is not None else first_done
    if at is None:
        at = gend
        while at - 1 > group and not content(lines[at - 1]).strip():
            at -= 1
        if at == group + 1:
            item_lines = [blank] + item_lines
    return lines[:at] + item_lines + lines[at:]


def apply(dashboard: Path, ref: str, action: str, to: str | None = None, today: dt.date | None = None) -> dict:
    today = today or dt.date.today()
    text = dashboard.read_text(encoding="utf-8")
    lines = text.split("\n")
    recs = scan(lines)
    rec = find(lines, recs, ref)
    i = rec["i"]
    raw = lines[i]
    prefix = PREFIX.match(raw).group(0)
    if action == "done":
        if rec["done"]:
            raise EditError("that item is already done")
        new = raw.replace("- [ ]", "- [x]", 1)
        lines[i] = new
        expect = content(new)
    elif action == "move":
        if to not in ("today", "tomorrow", "backlog"):
            raise EditError("move needs to: today, tomorrow or backlog")
        if rec["band"] == to or (to == "backlog" and rec["band"] == "backlog"):
            raise EditError(f"that item is already in {to}")
        j = block_end(lines, i)
        moved = [content(x) for x in lines[i:j]]
        del lines[i:j]
        recs = scan(lines)
        day_i, lines = target_day(lines, recs, to, today)
        tprefix = "" if to == "today" else "> "
        lines = insert_item(lines, day_i, rec["client"] or "**Other**", [tprefix + m for m in moved], tprefix)
        expect = moved[0]
    else:
        raise EditError("unknown action")
    snap = guard(dashboard)
    tmp = dashboard.with_name(".Dashboard.md.dashboard-edit")
    tmp.write_text("\n".join(lines), encoding="utf-8")
    os.replace(tmp, dashboard)
    after = dashboard.read_text(encoding="utf-8").split("\n")
    if not any(content(x) == expect for x in after):
        raise EditError(f"the edit did not stick (another writer?); snapshot at {snap}")
    return {"ok": True, "snapshot": str(snap)}
