#!/usr/bin/env python3
"""Fetch customer calendar feeds (feeds.json) and write the next two weeks of
events for the Day Board. Feed URLs never leave this machine; only event
fields (customer, title, start, end, all-day, location) are written out.
Usage: python3 sync_events.py <feeds.json> <out.json>
Needs: icalendar, recurring-ical-events (pip install --user icalendar recurring-ical-events)
"""
import json, sys, datetime as dt, urllib.request
import icalendar, recurring_ical_events

UTC = dt.timezone.utc
SKIP_PREFIX = ("canceled:", "cancelled:", "declined:")


def to_utc(v, tzname=None):
    if isinstance(v, dt.datetime):
        return (v if v.tzinfo else v.replace(tzinfo=UTC)).astimezone(UTC)
    return None


def main():
    feeds = json.load(open(sys.argv[1], encoding="utf-8"))
    today = dt.date.today()
    start, end = today - dt.timedelta(days=1), today + dt.timedelta(days=15)
    items, status = [], {}
    for customer, url in feeds.items():
        if customer.startswith("_") or not url:
            continue
        url = url.replace("webcal://", "https://", 1)
        try:
            raw = urllib.request.urlopen(url, timeout=60).read()
            cal = icalendar.Calendar.from_ical(raw)
            n = 0
            for ev in recurring_ical_events.of(cal).between(start, end):
                title = str(ev.get("SUMMARY", "") or "").strip() or "(no title)"
                if str(ev.get("STATUS", "")).upper() == "CANCELLED" or title.lower().startswith(SKIP_PREFIX):
                    continue
                s, e = ev.get("DTSTART").dt, (ev.get("DTEND").dt if ev.get("DTEND") else None)
                all_day = not isinstance(s, dt.datetime)
                if all_day:
                    s_iso = dt.datetime.combine(s, dt.time()).isoformat()
                    e_iso = dt.datetime.combine(e or s + dt.timedelta(days=1), dt.time()).isoformat()
                else:
                    su = to_utc(s); eu = to_utc(e) if isinstance(e, dt.datetime) else su
                    s_iso, e_iso = su.isoformat(), eu.isoformat()
                loc = str(ev.get("LOCATION", "") or "").strip()
                items.append({"customer": customer, "title": title[:200], "start": s_iso, "end": e_iso,
                              "allDay": all_day, "location": loc[:120] or None})
                n += 1
            status[customer] = {"ok": True, "events": n}
        except Exception as ex:  # report per feed, keep the others
            status[customer] = {"ok": False, "error": type(ex).__name__}
    items.sort(key=lambda x: x["start"])
    doc = {"syncedAt": dt.datetime.now(UTC).isoformat(timespec="seconds"), "feeds": status, "items": items}
    json.dump(doc, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
    print(json.dumps(status), len(items), "events")


if __name__ == "__main__":
    main()
