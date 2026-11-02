#!/usr/bin/env bun
/**
 * Builds the sidebar and loads the one HTML file in Chromium the way the
 * VS Code view does: wrapped in its content security policy, with a nonce
 * on every script and a stand-in `window.claude` that runs first. Fails on
 * any console error or page error, at phone and desktop widths, and when
 * the build is more than one file or links or loads anything.
 *
 * Run with `bun run check`, which builds with the example config first;
 * the story tests' Chromium is the one used.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

const dist = join(import.meta.dirname, "..", "dist");
const files = readdirSync(dist);
const problems: string[] = [];
if (files.join() !== "index.html") {
  problems.push(`the build is more than one file: ${files.join(", ")}`);
}
const source = readFileSync(join(dist, "index.html"), "utf8");
if (/<script\b[^>]*\ssrc=/i.test(source)) {
  problems.push("the build loads a script from a URL");
}
// The fonts are bundled, so the page links nothing at all.
for (const link of source.match(/<link\b[^>]*>/gi) ?? []) {
  problems.push(`the build links a file: ${link}`);
}

// The VS Code view's wrapper, as `Atlas.page` in the planner extension
// builds it: the same policy, and the nonce added to every script tag.
const nonce = "harness";
const csp = [
  "default-src 'none'",
  "img-src https: data:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  `script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com`,
].join("; ");
// The runtime stand-in answers the local server's tools and the connectors with invented
// data and fails every other tool as a connector this view does not have.
const shim = `(() => {
  const docs = new Map();
  const listeners = new Map();
  const snap = (path) => ({ id: path, exists: docs.has(path), data: () => docs.get(path) ?? null });
  const tools = {
    "host:dashboard/host_stats": () => ({ structuredContent: { hosts: [{
      clientId: "home", host: "harness-host", lastSeen: new Date().toISOString(),
      latest: { cpuPct: 12, memFreePct: 70, diskFreeGb: 80, runnersBusy: 2, runnersMax: 4 },
      samples: [], breaches: [{ metric: "cpuPct", level: "warn" }] }] } }),
    "host:dashboard/waiting_on_you": () => ({ structuredContent: { items: [
      { kind: "question", ask: "Which day suits the review?" }] } }),
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
  window.claude = { use: (name) => name === "mcp" ? Promise.resolve(mcp)
    : name === "db" ? Promise.resolve(db) : Promise.reject({ code: "not_granted" }) };
  window.__docs = docs;
})();`;
const body = source
  .replace(/^\s*<!doctype html>/i, "")
  .replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
const page = [
  "<!doctype html>",
  '<html><head><meta charset="utf-8">',
  `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
  `<script nonce="${nonce}">${shim}</script>`,
  "</head><body>",
  body,
  "</body></html>",
].join("\n");

const browser = await chromium.launch();
try {
  for (const width of [390, 1280]) {
    // The example config's home time zone, so wall-clock meetings read as written.
    const tab = await browser.newPage({
      viewport: { width, height: 900 },
      timezoneId: "Europe/London",
    });
    // No network at all: any request the page makes fails and is reported.
    await tab.route("**/*", (route) => route.abort());
    const errors: string[] = [];
    tab.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    tab.on("pageerror", (e) => errors.push(e.message));
    await tab.setContent(page, { waitUntil: "load" });
    const heading = await tab
      .locator("h1")
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => null);
    if (!heading?.startsWith("Atlas")) {
      problems.push(`${width}px: the sidebar did not render`);
    }
    // The next-up card and the calendar, from Google and Outlook merged.
    const nextTitle = await tab.locator(".nextup .title").textContent();
    if (!nextTitle || nextTitle === "—") {
      problems.push(`${width}px: the next-up card has no meeting`);
    }
    await tab.getByRole("tab", { name: "Calendar" }).click();
    for (const name of [
      "Harness Google meeting",
      "Harness Outlook meeting",
      "Harness worklist meeting",
    ]) {
      if (!(await tab.getByText(name).first().isVisible())) {
        problems.push(`${width}px: the calendar does not show ${name}`);
      }
    }
    await tab.getByRole("tab", { name: "Worklist" }).click();
    // The worklist, live: today's task, and the header says so.
    if (!(await tab.getByText("Harness task for today").isVisible())) {
      problems.push(`${width}px: the worklist does not show today's task`);
    }
    if ((await tab.locator(".sync").textContent()) !== "Live") {
      problems.push(`${width}px: the header does not say Live`);
    }
    // Details: the task opens its page, drawn without HTML, and Escape returns to it.
    const taskTitle = tab.getByRole("button", {
      name: "Harness task for today",
      exact: true,
    });
    await taskTitle.click();
    const dialog = tab.getByRole("dialog", { name: "Harness task for today" });
    if (
      !(await dialog
        .getByRole("heading", { name: "Harness heading" })
        .isVisible())
    ) {
      problems.push(`${width}px: the details page does not show`);
    }
    if (
      await tab.evaluate(
        () =>
          "__pwned" in window || document.querySelector(".md script") !== null,
      )
    ) {
      problems.push(`${width}px: the details page ran or kept a script`);
    }
    if (
      !(await dialog
        .getByRole("link", { name: "Harness pull request" })
        .isVisible())
    ) {
      problems.push(`${width}px: the task's pull request is not shown`);
    }
    if (!(await dialog.getByText("IN REVIEW").isVisible())) {
      problems.push(
        `${width}px: an open pull request does not put the status in review`,
      );
    }
    const pulls = await tab.evaluate(() =>
      (
        window as unknown as { __docs: Map<string, { prs?: unknown[] }> }
      ).__docs.get("prs/db-1"),
    );
    if (pulls?.prs?.length !== 1) {
      problems.push(
        `${width}px: the pull requests were not stored for other devices`,
      );
    }
    await tab.keyboard.press("Escape");
    if (
      (await dialog.count()) !== 0 ||
      !(await taskTitle.evaluate((el) => el === document.activeElement))
    ) {
      problems.push(
        `${width}px: Escape does not close the details and return to the task`,
      );
    }
    const copy = await tab.evaluate(() =>
      (
        window as unknown as {
          __docs: Map<string, { md?: string; copiedAt?: string }>;
        }
      ).__docs.get("details/harness-plan"),
    );
    if (!copy?.md || !copy.copiedAt) {
      problems.push(
        `${width}px: the details page was not copied for other devices`,
      );
    }
    // Waiting on you sits above the worklist and is stored for other devices.
    if (
      !(await tab.getByRole("region", { name: /waiting on you/i }).isVisible())
    ) {
      problems.push(`${width}px: waiting on you is not shown`);
    }
    // Release status sits above its client's tracker with every client shown.
    await tab.getByRole("tab", { name: "Kestrel Freight" }).click();
    if (!(await tab.getByRole("cell", { name: /harness-repo/ }).isVisible())) {
      problems.push(`${width}px: release status is not shown`);
    }
    // The Monday board, read through the connector, in the same client's tab.
    if (
      !(await tab
        .getByRole("link", { name: "Harness board item", exact: true })
        .isVisible())
    ) {
      problems.push(`${width}px: the Monday board is not shown`);
    }
    // GitHub issues, with links built from the configured repository.
    await tab.getByRole("tab", { name: "Meridian Bank" }).click();
    const issue = tab.getByRole("link", { name: "Harness issue" });
    if (
      (await issue.getAttribute("href")) !==
      "https://github.com/meridian-bank/ledger/issues/5"
    ) {
      problems.push(`${width}px: the GitHub issue is not shown with its link`);
    }
    // Jira, from the copy the Mac's sync stored a moment ago.
    await tab.getByRole("tab", { name: "Halcyon Labs" }).click();
    if (
      !(await tab.getByRole("link", { name: "Harness Jira issue" }).isVisible())
    ) {
      problems.push(`${width}px: the Jira issue from the sync is not shown`);
    }
    // Hosts end to end: the tab shows the breach, the panel the host, and
    // the copy for other devices is stored in the previous page's shape.
    const hostsTab = tab.getByRole("tab", { name: /host alert/i });
    if ((await hostsTab.getAttribute("class"))?.includes("warn") !== true) {
      problems.push(`${width}px: the hosts tab does not show the warning`);
    }
    await hostsTab.click();
    await tab.getByRole("button", { name: /harness-host/ }).click();
    if (!(await tab.getByText("of 4").isVisible())) {
      problems.push(`${width}px: the host's runners are not shown`);
    }
    const stored = await tab.evaluate(() =>
      (
        window as unknown as {
          __docs: Map<string, { storedAt?: string; hosts?: unknown[] }>;
        }
      ).__docs.get("board/hosts"),
    );
    if (!stored?.storedAt || stored.hosts?.length !== 1) {
      problems.push(`${width}px: board/hosts was not stored with storedAt`);
    }
    const release = await tab.evaluate(() =>
      (
        window as unknown as { __docs: Map<string, { checkedAt?: string }> }
      ).__docs.get("board/release"),
    );
    if (!release?.checkedAt) {
      problems.push(`${width}px: board/release was not stored`);
    }
    const tasks = await tab.evaluate(() =>
      (
        window as unknown as { __docs: Map<string, { items?: unknown[] }> }
      ).__docs.get("board/tasks"),
    );
    if (tasks?.items?.length !== 4) {
      problems.push(`${width}px: board/tasks was not stored`);
    }
    const waiting = await tab.evaluate(() =>
      (
        window as unknown as {
          __docs: Map<string, { storedAt?: string; items?: unknown[] }>;
        }
      ).__docs.get("board/waiting"),
    );
    if (!waiting?.storedAt || waiting.items?.length !== 1) {
      problems.push(`${width}px: board/waiting was not stored with storedAt`);
    }
    // Writes, against the stand-in. Status from a task's menu shows Commander's answer under it.
    await tab.getByRole("tab", { name: "Worklist" }).click();
    await tab
      .getByRole("button", { name: "Actions for Harness task for today" })
      .click();
    await tab.getByRole("menuitem", { name: "Status" }).click();
    if (!(await tab.getByText("status · received").isVisible())) {
      problems.push(
        `${width}px: a status request does not show under the task`,
      );
    }
    // Done in the details marks it done, closes the details and stores the fresh worklist.
    await tab
      .getByRole("button", { name: "Harness task for today", exact: true })
      .click();
    await tab.getByRole("button", { name: "Done", exact: true }).click();
    await tab
      .getByRole("dialog")
      .waitFor({ state: "detached", timeout: 5000 })
      .catch(() => undefined);
    const doneTask = await tab.evaluate(() =>
      (
        window as unknown as {
          __docs: Map<
            string,
            { items?: Array<{ ref?: string; done?: boolean }> }
          >;
        }
      ).__docs
        .get("board/tasks")
        ?.items?.find((t) => t.ref === "db:1"),
    );
    if (
      (await tab.getByRole("dialog").count()) !== 0 ||
      doneTask?.done !== true
    ) {
      problems.push(
        `${width}px: Done does not close the details and store the task as done`,
      );
    }
    // Triage grades the ungraded task in one call.
    await tab.getByRole("button", { name: "Actions for the worklist" }).click();
    await tab.getByRole("menuitem", { name: /^Triage 1 ungraded/ }).click();
    await tab
      .getByRole("combobox", { name: "Business value for Harness second task" })
      .selectOption("medium");
    await tab
      .getByRole("combobox", { name: "Effort for Harness second task" })
      .selectOption("S");
    await tab.getByRole("button", { name: "Save 1 grade" }).click();
    const graded = await tab.evaluate(
      () =>
        (
          (
            window as unknown as {
              __calls?: Array<{ tool: string; args?: { grades?: unknown } }>;
            }
          ).__calls ?? []
        ).find((c) => c.tool === "task_grade_many")?.args?.grades,
    );
    if (
      JSON.stringify(graded) !==
      JSON.stringify([{ ref: "db:2", value: "medium", effort: "S" }])
    ) {
      problems.push(`${width}px: Triage does not save the grade`);
    }
    await tab
      .getByText("Graded 1.")
      .waitFor({ timeout: 5000 })
      .catch(() => {
        problems.push(`${width}px: Triage does not say what it saved`);
      });
    await tab.keyboard.press("Escape");
    // The quadrant badge opens the value, effort and due date form, which saves only the change.
    await tab
      .getByRole("button", { name: "Harness second task", exact: true })
      .click();
    await tab.getByRole("button", { name: /Q/, expanded: false }).click();
    await tab.getByRole("combobox", { name: "Effort" }).selectOption("L");
    await tab.getByRole("button", { name: "Save", exact: true }).click();
    const assessed = await tab.evaluate(
      () =>
        (
          (
            window as unknown as {
              __calls?: Array<{ tool: string; args?: unknown }>;
            }
          ).__calls ?? []
        ).find((c) => c.tool === "task_assess")?.args,
    );
    if (
      JSON.stringify(assessed) !== JSON.stringify({ ref: "db:2", effort: "L" })
    ) {
      problems.push(`${width}px: the form does not save only the change`);
    }
    await tab.keyboard.press("Escape");
    // A Monday row whose task exists goes to it in the worklist; one without asks Commander to plan it.
    await tab.getByRole("tab", { name: "Kestrel Freight" }).click();
    await tab.getByRole("button", { name: "Plan KF-9 with Commander" }).click();
    const planned = await tab.evaluate(
      () =>
        (
          (
            window as unknown as {
              __calls?: Array<{
                tool: string;
                args?: { system?: string; key?: string };
              }>;
            }
          ).__calls ?? []
        ).find((c) => c.tool === "commander_plan")?.args,
    );
    if (
      planned?.system !== "monday" ||
      planned?.key !== "KF-9" ||
      !(await tab.getByText("plan · received").isVisible())
    ) {
      problems.push(
        `${width}px: a Monday row without a task is not planned with Commander`,
      );
    }
    await tab
      .getByRole("button", { name: "Open the task for KF-10 in the worklist" })
      .click();
    const flashed = tab.locator('.task[data-ref="db:3"]');
    if (
      (await tab
        .getByRole("tab", { name: "Worklist" })
        .getAttribute("aria-selected")) !== "true" ||
      !(await flashed.isVisible())
    ) {
      problems.push(
        `${width}px: a Monday row does not go to its task in the worklist`,
      );
    }
    await tab.getByRole("button", { name: "Today", exact: true }).click();
    // On the phone: without the local server, a change goes through the inbox.
    await tab.evaluate(() => {
      (window as unknown as { __offline: boolean }).__offline = true;
    });
    await tab
      .getByRole("button", { name: "Actions for Harness second task" })
      .click();
    await tab.getByRole("menuitem", { name: "Move to Tomorrow" }).click();
    const inserted = await tab.evaluate(() =>
      (
        (
          window as unknown as {
            __calls?: Array<{
              tool: string;
              args?: { sql?: string; params?: unknown[] };
            }>;
          }
        ).__calls ?? []
      )
        .filter(
          (c) =>
            c.tool === "d1_database_query" && c.args?.sql?.startsWith("INSERT"),
        )
        .map((c) => c.args?.params?.[1]),
    );
    if (
      !inserted.includes("task_move") ||
      !(await tab.getByText("move · queued").isVisible())
    ) {
      problems.push(
        `${width}px: a move from the phone does not go through the inbox`,
      );
    }
    for (const e of errors) problems.push(`${width}px: ${e}`);
    await tab.close();
  }
} finally {
  await browser.close();
}

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log(
  `✓ one file, ${Math.round(source.length / 1024)} KB, renders at 390 and 1280 px with no errors; every panel works end to end`,
);
