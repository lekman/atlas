#!/usr/bin/env bun
/**
 * Builds the sidebar and loads the one HTML file in Chromium the way the
 * VS Code view does: wrapped in its content security policy, with a nonce
 * on every script and a stand-in `window.claude` that runs first. Fails on
 * any console error or page error, at phone and desktop widths, and when
 * the build is more than one file or links or loads anything.
 *
 * Run after `bun run build`; the story tests' Chromium is the one used.
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
// The runtime stand-in answers host_stats and waiting_on_you with invented
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
  };
  const mcp = {
    callTool: async (server, tool) => {
      const answer = tools[server + "/" + tool];
      if (!answer) throw { code: "not_granted" };
      return answer();
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
    const tab = await browser.newPage({ viewport: { width, height: 900 } });
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
    // Waiting on you sits above the worklist and is stored for other devices.
    if (
      !(await tab.getByRole("region", { name: /waiting on you/i }).isVisible())
    ) {
      problems.push(`${width}px: waiting on you is not shown`);
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
  `✓ one file, ${Math.round(source.length / 1024)} KB, renders at 390 and 1280 px with no errors; hosts and waiting work end to end`,
);
