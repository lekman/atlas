/**
 * What the harnesses share: the VS Code view's content security policy,
 * the stand-in `window.claude` that answers the local server's tools and
 * the connectors with invented data, and the wrapper that puts a built page
 * inside both, as `Atlas.page` in the planner extension does.
 */
// The VS Code view's wrapper, as `Atlas.page` in the planner extension
// builds it: the same policy, and the nonce added to every script tag.
export const nonce = "harness";
export const csp = [
  "default-src 'none'",
  "img-src https: data:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  `script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com`,
].join("; ");
// The runtime stand-in answers the local server's tools and the connectors with invented
// data and fails every other tool as a connector this view does not have.
export const shim = `(() => {
  const docs = new Map();
  const listeners = new Map();
  const snap = (path) => ({ id: path, exists: docs.has(path), data: () => docs.get(path) ?? null });
  const tools = {
    "host:dashboard/host_stats": () => ({ structuredContent: { hosts: [{
      clientId: "home", host: "harness-host", lastSeen: new Date().toISOString(),
      latest: { cpuPct: 12, memFreePct: 70, diskFreeGb: 80, runnersBusy: 2, runnersMax: 4 },
      samples: [], breaches: [{ metric: "cpuPct", level: "warn" }] }] } }),
    "host:dashboard/waiting_on_you": () => ({ structuredContent: { items: [
      { kind: "question", id: "q1", ask: "Which day suits the review?", options: [
        { label: "Thursday", description: "The team is free all afternoon.", recommended: true },
        { label: "Friday" }] },
      { kind: "question", id: "q2", ask: "Keep the Friday retro?" },
      { kind: "question", id: "q3", ask: "Move the standup to 09:30?" }] } }),
    "host:dashboard/commander_answer": (args) => ({ structuredContent: { request: {
      id: args.id, state: "received", action: "answer", summary: "Harness Commander has the answer", updatedAt: new Date().toISOString() } } }),
    "monday.com/get_board_items_page": () => ({ payload: { items: [{
      name: "Harness board item", url: "https://example.monday.com/1", updated_at: new Date().toISOString(),
      column_values: { status: "Stuck", priority: "High", number: "9" } },
      { name: "Harness board item with a task", url: "https://example.monday.com/2", updated_at: new Date().toISOString(),
        column_values: { status: "Working on it", priority: "Medium", number: "10" } }] } }),
    "GitHub/list_issues": () => ({ payload: { totalCount: 1, issues: [
      { number: 5, title: "Harness issue", labels: ["bug"], assignees: ["harness"], updated_at: new Date().toISOString() }] } }),
    "GitHub/get_me": () => ({ payload: { login: "harness" } }),
    "host:dashboard/sync_now": () => ({ structuredContent: {
      events: { ok: true, doc: { syncedAt: new Date().toISOString(), items: [] } },
      jira: { ok: true, doc: { ok: true, syncedAt: new Date().toISOString(), items: [
        { key: "HAR-1", summary: "Harness Jira issue", url: "https://example.atlassian.net/browse/HAR-1",
          status: "In Progress", category: "indeterminate", type: "Story" }] } } } }),
    "Google Calendar/list_events": () => ({ payload: { events: [{ summary: "Harness Google meeting",
      start: { dateTime: new Date(Date.now() + 30 * 60000).toISOString() },
      end: { dateTime: new Date(Date.now() + 60 * 60000).toISOString() } }] } }),
    "Microsoft 365/outlook_calendar_search": () => ({ content: [{ type: "text", text: JSON.stringify({
      id: "o1", subject: "Harness Outlook meeting",
      start: { dateTime: new Date(Date.now() + 90 * 60000).toISOString().replace("Z", ""), timeZone: "UTC" },
      end: { dateTime: new Date(Date.now() + 120 * 60000).toISOString().replace("Z", ""), timeZone: "UTC" } }) }] }),
    "host:dashboard/worklist": () => {
      const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const hm = (d) => d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
      // A meeting a minute from now, on its own day, so the run never straddles midnight.
      const now = new Date(), from = new Date(now.getTime() + 60000), to = new Date(now.getTime() + 120000);
      return { structuredContent: { syncedAt: now.toISOString(), items: [
        { ref: "db:1", title: "Harness task for today", customer: "kestrel", band: "today", day: ymd(now), priority: "high",
          details: "Harness/Plan.md", detailsAt: "2026-03-01T00:00:00Z", key: "HAR-1" },
        { ref: "db:2", title: "Harness second task", customer: "kestrel", band: "today", day: ymd(now) },
        { ref: "db:3", title: "Harness tracked task", customer: "kestrel", band: "tomorrow", key: "KF-10",
          quadrant: "Q2-schedule", value: "medium", effort: "S",
          day: ymd(new Date(now.getTime() + 86400000)) },
        { title: "Harness worklist meeting", customer: "kestrel", band: "today", day: ymd(from),
          meeting: { start: hm(from), end: ymd(to) === ymd(from) ? hm(to) : hm(from) } }] } };
    },
    "host:dashboard/details_read": () => ({ structuredContent: { path: "Harness/Plan.md", modifiedAt: "2026-03-01T00:00:00Z",
      md: "---\\nstatus: planned\\n---\\n# Plan\\n\\n## Harness heading\\n\\n<script>window.__pwned = 1<\\/script> [x](javascript:window.__pwned=1)\\n" } }),
    "host:dashboard/task_prs": () => ({ structuredContent: { linked: false, fetchedAt: new Date().toISOString(), prs: [
      { repo: "acme/app", number: 7, title: "Harness pull request", url: "https://github.com/acme/app/pull/7",
        state: "open", checks: "success" }] } }),
    "host:dashboard/commander_send": (args) => ({ structuredContent: { request: {
      id: args.id, state: "received", action: args.action, summary: "Harness Commander heard it", updatedAt: new Date().toISOString() } } }),
    "host:dashboard/task_done": () => {
      const list = tools["host:dashboard/worklist"]().structuredContent;
      return { structuredContent: { tasks: { ...list, items: list.items.map((t) => t.ref === "db:1" ? { ...t, done: true } : t) } } };
    },
    "host:dashboard/task_state": (args) => {
      const list = tools["host:dashboard/worklist"]().structuredContent;
      return { structuredContent: { tasks: { ...list, items: list.items.map((t) =>
        t.ref === args.ref ? { ...t, state: args.state, done: args.state === "done" } : t) } } };
    },
    "Cloudflare Developer Platform/d1_database_query": () => ({ payload: [{ results: [] }] }),
    "host:dashboard/task_grade_many": (args) => ({ structuredContent: { graded: args.grades.map((g) => g.ref), skipped: [] } }),
    "host:dashboard/task_assess": () => ({ structuredContent: {} }),
    "host:dashboard/commander_plan": (args) => ({ structuredContent: { request: {
      id: args.id, state: "received", action: "plan", updatedAt: new Date().toISOString() } } }),
    "host:dashboard/release_status": () => ({ structuredContent: {
      branch: "release/x", total: 3, checkedAt: new Date().toISOString(),
      drifted: [{ repo: "harness-repo", envs: { staging: "failed" } }] } }),
  };
  // window.__offline makes the local server unreachable, as on the phone.
  const mcp = {
    callTool: async (server, tool, args) => {
      if (window.__offline && server === "host:dashboard") throw { code: "server_not_connected" };
      // window.__refuse names a tool the page's manifest does not declare.
      if (window.__refuse === tool) throw { code: "not_in_manifest" };
      (window.__calls = window.__calls || []).push({ server, tool, args });
      const answer = tools[server + "/" + tool];
      if (!answer) throw { code: "not_granted" };
      return answer(args);
    },
    watchTool(server, tool, args, onEvent) {
      mcp.callTool(server, tool, args).then(
        (result) => onEvent({ type: "data", result }),
        (error) => onEvent({ type: "error", error }));
      return () => {};
    },
  };
  const db = { doc: (path) => ({
    get: async () => snap(path),
    set: async (data) => { docs.set(path, data); for (const fn of listeners.get(path) ?? []) fn(snap(path)); },
    delete: async () => { docs.delete(path); },
    onSnapshot: (next) => {
      if (!listeners.has(path)) listeners.set(path, new Set());
      listeners.get(path).add(next); next(snap(path));
      return () => listeners.get(path).delete(next);
    } }) };
  // window.__host, set before this runs, plays the VS Code extension's host:
  // a mode makes the page a details tab, and openDetails records each ref,
  // failing while window.__hostRefuses is set.
  const host = window.__host && { ...window.__host, openDetails: async (ref) => {
    (window.__opened = window.__opened || []).push(ref);
    if (window.__hostRefuses) throw { code: "upstream_error" };
    return null;
  } };
  window.claude = { use: (name) => name === "mcp" ? Promise.resolve(mcp)
    : name === "db" ? Promise.resolve(db)
    : name === "host" && host ? Promise.resolve(host) : Promise.reject({ code: "not_granted" }) };
  window.__docs = docs;
})();`;

/** A built page as the VS Code view wraps it, with `before` run ahead of the stand-in. */
export function wrapPage(source: string, before = ""): string {
  const body = source
    .replace(/^\s*<!doctype html>/i, "")
    .replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    before && `<script nonce="${nonce}">${before}</script>`,
    `<script nonce="${nonce}">${shim}</script>`,
    "</head><body>",
    body,
    "</body></html>",
  ]
    .filter(Boolean)
    .join("\n");
}
