#!/usr/bin/env python3
"""Parse Dashboard.md into a compact task list for the Day Board artifact.

Reads only headline fields (customer, band, day, title, priority, flags, ticket
key/link, done). Prose and [Details] links are deliberately left out.
Usage: python3 sync_tasks.py <vault-dir> <out.json>
"""
import hashlib, json, re, sys, urllib.parse, datetime as dt
from pathlib import Path

import host_config

MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december"], 1)}
PRIO = {"🔴": "high", "🟡": "medium", "⚪": "low", "🟢": "low"}
FLAGS = {"🚧": "blocked", "🔄": "active", "🧾": "admin", "💰": "cost", "⚠️": "attention", "⚠": "attention"}
MDLINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
KEYTXT = re.compile(r"^[A-Z][A-Z0-9]+-\d+$")
TIME = re.compile(r"📅\s*(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})")


def strip_md(s):
    s = MDLINK.sub(lambda m: m.group(1), s)
    s = re.sub(r"[*_`]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def day_of(text, today):
    m = re.match(r"^(?:\w+day)\s+(\d{1,2})\s+(\w+)", text.strip(), re.I)
    if not m or m.group(2).lower() not in MONTHS:
        return None
    d, mo = int(m.group(1)), MONTHS[m.group(2).lower()]
    year = today.year + (1 if mo < today.month - 6 else 0) - (1 if mo > today.month + 6 else 0)
    try:
        return dt.date(year, mo, d).isoformat()
    except ValueError:
        return None


def line_ref(line):
    """Stable id for one dashboard line: its text without callout prefixes, hashed."""
    return hashlib.sha1(line.strip().encode("utf-8")).hexdigest()[:12]


def parse(md, today):
    items, band, day, cust, started, order = [], None, None, None, False, 0
    for raw in md.splitlines():
        line = re.sub(r"^(?:>\s?)+", "", raw).rstrip()
        if raw.startswith("## ") and started:
            break  # end of the Focus section (e.g. "## Initiatives")
        if re.match(r"^\[!note\]-\s*Tomorrow", line):
            band = "tomorrow"; continue
        if re.match(r"^\[!note\]-\s*Future", line):
            band = "future"; continue
        h3 = re.match(r"^###\s+(.*)$", line)
        if h3:
            started = True
            title = h3.group(1).strip()
            if band is None:
                band = "today"
            if title.lower().startswith("unscheduled"):
                band, day = "unscheduled", None
            else:
                day = day_of(title, today)
            cust = None
            continue
        if not started:
            continue
        h4 = re.match(r"^####\s+\**(.+?)\**\s*$", line)
        if h4:
            cust = host_config.clients()["headings"].get(strip_md(h4.group(1)).lower(), "other"); continue
        it = re.match(r"^\s*- \[( |x|X)\]\s+(.*)$", line)
        if not it:
            continue
        done, rest = it.group(1).lower() == "x", it.group(2)
        if done and band != "today":
            continue
        key = link = None
        for m in MDLINK.finditer(rest):
            if KEYTXT.match(m.group(1).strip()):
                key, url = m.group(1).strip(), m.group(2).strip()
                link = url if url.startswith("https://") else None
                break
        bold = re.search(r"\*\*(.+?)\*\*", rest)
        title = strip_md(bold.group(1)) if bold else strip_md(re.split(r" — | · ", rest)[0])
        if key and title.startswith(key):
            title = title[len(key):].strip()
        title = title.rstrip(".").strip()
        if len(title) > 180:
            title = title[:177].rstrip() + "…"
        head = rest[: bold.start()] if bold else rest[:40]
        prio = next((v for k, v in PRIO.items() if k in head), None)
        flags = sorted({v for k, v in FLAGS.items() if k in head})
        details = next((urllib.parse.unquote(m.group(2).strip()) for m in MDLINK.finditer(rest)
                        if m.group(1).strip().lower() == "details" and not m.group(2).startswith(("http:", "https:"))), None)
        tm = TIME.search(rest)
        order += 1
        items.append({
            "customer": cust or "other", "band": band, "day": day, "title": title,
            "done": done, "priority": prio, "flags": flags, "key": key, "link": link,
            "meeting": {"start": tm.group(1), "end": tm.group(2)} if tm else None,
            "order": order, "ref": line_ref(line), "details": details,
        })
    return items


def main():
    vault, out = Path(sys.argv[1]), Path(sys.argv[2])
    md = (vault / "Dashboard.md").read_text(encoding="utf-8")
    today = dt.date.today()
    items = parse(md, today)
    stat = (vault / "Dashboard.md").stat()
    doc = {
        "vault": vault.resolve().name,
        "syncedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "sourceModifiedAt": dt.datetime.fromtimestamp(stat.st_mtime, dt.timezone.utc).isoformat(timespec="seconds"),
        "items": items,
    }
    out.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    counts = {}
    for i in items:
        counts[(i["band"], i["customer"])] = counts.get((i["band"], i["customer"]), 0) + 1
    print(len(items), "items,", len(out.read_bytes()), "bytes")
    for k, v in sorted(counts.items(), key=lambda x: str(x)):
        print(" ", k, v)


if __name__ == "__main__":
    main()
