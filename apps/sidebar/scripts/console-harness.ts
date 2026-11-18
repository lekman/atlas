#!/usr/bin/env bun
/**
 * Builds nothing: loads `dist-console/console.html` in Chromium the way the
 * VS Code view and the artifact do, wrapped in the content security policy
 * with the stand-in `window.claude` (see harness-runtime.ts). Fails on any
 * console or page error, any network request, and when the build is more
 * than one file. At each of the four sizes it checks the layout, that
 * today's task shows, that Done and Move reach the local server, and
 * that Shields shows the host with its breach; then
 * that a move with the server unreachable is queued for the Mac mini.
 *
 * Run with `bun run check:console`. With SHOTS=<folder> it also saves a
 * screenshot at each size.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { wrapPage } from "./harness-runtime";

const dist = join(import.meta.dirname, "..", "dist-console");
const files = readdirSync(dist);
const problems: string[] = [];
if (files.join() !== "console.html")
  problems.push(`the build is more than one file: ${files.join(", ")}`);
const source = readFileSync(join(dist, "console.html"), "utf8");
if (/<script\b[^>]*\ssrc=/i.test(source))
  problems.push("the build loads a script from a URL");
for (const link of source.match(/<link\b[^>]*>/gi) ?? [])
  problems.push(`the build links a file: ${link}`);

const sizes = [
  { name: "sidebar", width: 380, height: 820, layout: "single" },
  { name: "phone closed", width: 466, height: 678, layout: "single" },
  { name: "phone open", width: 890, height: 626, layout: "split" },
  { name: "laptop", width: 1440, height: 900, layout: "wide" },
] as const;

type Calls = Array<{
  server: string;
  tool: string;
  args: Record<string, unknown>;
}>;

const browser = await chromium.launch();
try {
  for (const size of sizes) {
    const tab = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      timezoneId: "Europe/London",
    });
    await tab.route("**/*", (route) => route.abort());
    const errors: string[] = [];
    tab.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    tab.on("pageerror", (e) => errors.push(e.message));
    await tab.setContent(wrapPage(source), { waitUntil: "load" });
    const at = `${size.name} (${size.width}px)`;

    const layout = await tab
      .locator(".atlas-console")
      .getAttribute("data-layout", { timeout: 5000 })
      .catch(() => null);
    if (layout !== size.layout)
      problems.push(`${at}: layout is ${layout}, expected ${size.layout}`);
    const task = tab
      .getByRole("button", { name: /Harness task for today/ })
      .first();
    if (!(await task.isVisible({ timeout: 5000 }).catch(() => false)))
      problems.push(`${at}: today's task is not shown`);
    const relay = await tab.getByRole("status").textContent();
    if (relay?.trim() !== "Live")
      problems.push(`${at}: the relay says "${relay}", not Live`);
    if (process.env.SHOTS)
      await tab.screenshot({
        path: join(process.env.SHOTS, `console-${size.width}.png`),
      });

    await tab
      .getByRole("button", { name: "Actions for Harness second task" })
      .click();
    await tab.getByRole("menuitem", { name: "Move to Tomorrow" }).click();
    await task.click();
    const detail = tab.getByRole("group", { name: "Task actions" });
    if (
      !(await tab
        .getByRole("region", { name: "Details page" })
        .isVisible({ timeout: 5000 })
        .catch(() => false))
    )
      problems.push(`${at}: the task detail has no details page section`);
    if (
      !(await tab
        .getByText("Harness heading")
        .isVisible({ timeout: 5000 })
        .catch(() => false))
    )
      problems.push(`${at}: the details page body is not shown`);
    if (
      !(await tab
        .getByText("Harness pull request")
        .isVisible({ timeout: 5000 })
        .catch(() => false))
    )
      problems.push(`${at}: the task's pull request is not shown`);
    await detail.getByRole("button", { name: "Done", exact: true }).click();
    await tab.waitForTimeout(200);
    const calls = (await tab.evaluate(
      () => (window as unknown as { __calls?: Calls }).__calls ?? [],
    )) as Calls;
    const moved = calls.find((c) => c.tool === "task_move");
    if (moved?.args.ref !== "db:2" || moved.args.to !== "tomorrow")
      problems.push(
        `${at}: Move did not reach the local server as task_move to tomorrow`,
      );
    if (!calls.some((c) => c.tool === "task_done" && c.args.ref === "db:1"))
      problems.push(`${at}: Done did not reach the local server`);
    await tab
      .getByRole("button", { name: /Shields/ })
      .first()
      .click();
    const hostRow = tab.getByRole("button", {
      name: /^Needs a look: harness-host/,
    });
    if (!(await hostRow.isVisible({ timeout: 5000 }).catch(() => false)))
      problems.push(
        `${at}: Shields does not show the host with its CPU warning`,
      );
    else {
      await hostRow.click();
      if (
        !(await tab
          .getByText(/over its warning limit/)
          .isVisible({ timeout: 3000 })
          .catch(() => false))
      )
        problems.push(`${at}: the host's detail does not name the breach`);
    }
    if (errors.length) problems.push(`${at}: ${errors.join(" | ")}`);
    await tab.close();
  }

  // The phone without the local server: the move is queued for the Mac mini.
  const tab = await browser.newPage({ viewport: { width: 466, height: 678 } });
  await tab.route("**/*", (route) => route.abort());
  await tab.setContent(wrapPage(source), { waitUntil: "load" });
  await tab
    .getByRole("button", { name: "Actions for Harness second task" })
    .click({ timeout: 5000 });
  await tab.evaluate(() => {
    (window as unknown as { __offline: boolean }).__offline = true;
  });
  await tab.getByRole("menuitem", { name: "Move to Backlog" }).click();
  await tab.waitForTimeout(300);
  const docs = await tab.evaluate(() =>
    JSON.stringify([
      ...((window as unknown as { __docs: Map<string, unknown> }).__docs ??
        new Map()),
    ]),
  );
  if (!/"move"/.test(docs) || !/db:2/.test(docs))
    problems.push("offline: the move was not queued in the phone inbox");
  await tab.close();
} finally {
  await browser.close();
}

if (problems.length) {
  console.error(`✗ console harness:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `✓ one file, ${Math.round(source.length / 1024)} KB; sidebar, folding phone closed and open, and laptop render with no errors; Done, Move, the task detail with its page and pull request, Shields and an offline move work`,
);
