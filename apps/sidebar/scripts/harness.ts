#!/usr/bin/env bun
/**
 * Builds the sidebar and loads the one HTML file in Chromium the way the
 * VS Code view does: wrapped in its content security policy, with a nonce
 * on every script and a stand-in `window.claude` that runs first. Fails on
 * any console error or page error, at phone and desktop widths, and when
 * the build is more than one file or loads a script from anywhere.
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
for (const link of source.match(/<link\b[^>]*>/gi) ?? []) {
  if (!link.includes("https://fonts.googleapis.com")) {
    problems.push(`the build links something besides Google Fonts: ${link}`);
  }
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
const shim = `window.claude = { use: (name) => name === "db"
  ? Promise.resolve({ doc: (path) => ({
      get: async () => ({ id: path, exists: false, data: () => null }),
      set: async () => {}, delete: async () => {},
      onSnapshot: (next) => { next({ id: path, exists: false, data: () => null }); return () => {}; } }) })
  : Promise.reject({ code: "not_granted" }) };`;
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
    // No network: fonts answer empty, so a missing font is not an error.
    await tab.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ contentType: "text/css", body: "" }),
    );
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
  `✓ one file, ${Math.round(source.length / 1024)} KB, renders at 390 and 1280 px with no errors`,
);
