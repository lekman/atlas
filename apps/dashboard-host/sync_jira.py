#!/usr/bin/env python3
"""Read the Jira issues assigned to you (not Done) for the Dashboard.
Credentials come from jira.json and never leave this machine; only issue
key, summary, status, priority, type, due date and updated time are written.
Usage: python3 sync_jira.py <jira.json> <out.json>
"""
import base64, json, sys, datetime as dt, urllib.parse, urllib.request

JQL = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC"
FIELDS = "summary,status,priority,issuetype,duedate,updated,parent"


def main():
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    out = {"syncedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "ok": False, "items": []}
    if not cfg.get("email") or not cfg.get("token"):
        out["error"] = "not_configured"
    else:
        site = cfg["site"].rstrip("/")
        auth = base64.b64encode(f'{cfg["email"]}:{cfg["token"]}'.encode()).decode()
        token, items = None, []
        try:
            for _ in range(5):  # at most 500 issues
                q = {"jql": JQL, "fields": FIELDS, "maxResults": 100}
                if token:
                    q["nextPageToken"] = token
                req = urllib.request.Request(f"{site}/rest/api/3/search/jql?{urllib.parse.urlencode(q)}",
                                             headers={"Authorization": f"Basic {auth}", "Accept": "application/json"})
                page = json.load(urllib.request.urlopen(req, timeout=60))
                for i in page.get("issues", []):
                    f = i.get("fields", {})
                    st = f.get("status") or {}
                    items.append({
                        "key": i["key"], "url": f"{site}/browse/{i['key']}",
                        "summary": (f.get("summary") or "")[:200],
                        "status": st.get("name"), "category": (st.get("statusCategory") or {}).get("key"),
                        "priority": (f.get("priority") or {}).get("name"),
                        "type": (f.get("issuetype") or {}).get("name"),
                        "parent": ((f.get("parent") or {}).get("key")),
                        "due": f.get("duedate"), "updated": f.get("updated"),
                    })
                token = page.get("nextPageToken")
                if not token or page.get("isLast"):
                    break
            out.update(ok=True, items=items)
        except urllib.error.HTTPError as e:
            out["error"] = f"http_{e.code}"
        except Exception as e:
            out["error"] = type(e).__name__
    json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
    print(json.dumps({"ok": out["ok"], "issues": len(out["items"]), "error": out.get("error")}))


if __name__ == "__main__":
    main()
