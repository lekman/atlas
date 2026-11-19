#!/usr/bin/env bun
/**
 * Builds nothing: loads `dist-console/console.html` in Chromium the way the
 * VS Code view and the artifact do, wrapped in the content security policy
 * with the stand-in `window.claude` (see harness-runtime.ts). Fails on any
 * console or page error, any network request, and when the build is more
 * than one file. At each of the four sizes it checks the layout, that
 * today's task shows, that Done (from the Status dropdown) and Move reach
 * the local server, and
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

/** The console shows a claimed task's agent; the sidebar's harness leaves tasks unclaimed. */
const CLAIMED = "window.__claimed = true;";
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
    await tab.setContent(wrapPage(source, CLAIMED), { waitUntil: "load" });
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
        .getByRole("region", { name: "Details" })
        .isVisible({ timeout: 5000 })
        .catch(() => false))
    )
      problems.push(`${at}: the task detail has no details page section`);
    // The page opens at its start; Read more shows the rest.
    const readMore = tab.getByRole("button", { name: "Read more" });
    const canRead = await readMore
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!canRead) problems.push(`${at}: a long details page has no Read more`);
    else if (await tab.getByText("Harness heading").isVisible())
      problems.push(
        `${at}: the details page shows past its start before Read more`,
      );
    else await readMore.click();
    if (
      !(await tab
        .getByText("Harness heading")
        .waitFor({ timeout: 5000 })
        .then(() => true)
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
    if (
      await detail
        .getByRole("button", { name: "Done", exact: true })
        .isVisible()
        .catch(() => false)
    )
      problems.push(`${at}: Done is still a button in the task actions`);
    if (
      await tab
        .getByRole("button", { name: "Plan", exact: true })
        .isVisible()
        .catch(() => false)
    )
      problems.push(`${at}: Plan shows on a task that has a details page`);
    // A refused save puts the old status back and says why beside it.
    await tab.evaluate(() => {
      (window as unknown as { __refuse?: string }).__refuse = "task_state";
    });
    const statusPick = tab.getByRole("combobox", { name: "Status" });
    await statusPick.selectOption("review");
    const refused = await tab
      .getByRole("alert")
      .filter({ hasText: "isn't switched on" })
      .waitFor({ timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!refused)
      problems.push(`${at}: a refused status change shows no reason`);
    if ((await statusPick.inputValue()) !== "todo")
      problems.push(`${at}: a refused status change did not go back`);
    await tab.evaluate(() => {
      (window as unknown as { __refuse?: string }).__refuse = undefined;
    });
    await tab.getByRole("combobox", { name: "Value" }).selectOption("high");
    await tab.getByRole("combobox", { name: "Effort" }).selectOption("S");
    await tab.getByRole("combobox", { name: "Status" }).selectOption("done");
    await tab.waitForTimeout(200);
    const calls = (await tab.evaluate(
      () => (window as unknown as { __calls?: Calls }).__calls ?? [],
    )) as Calls;
    const moved = calls.find((c) => c.tool === "task_move");
    if (moved?.args.ref !== "db:2" || moved.args.to !== "tomorrow")
      problems.push(
        `${at}: Move did not reach the local server as task_move to tomorrow`,
      );
    const assessed = calls.filter((c) => c.tool === "task_assess");
    if (
      !assessed.some((c) => c.args.ref === "db:1" && c.args.value === "high") ||
      !assessed.some((c) => c.args.ref === "db:1" && c.args.effort === "S")
    )
      problems.push(`${at}: the Grade selectors did not reach task_assess`);
    if (!calls.some((c) => c.tool === "task_done" && c.args.ref === "db:1"))
      problems.push(
        `${at}: Done from the Status dropdown did not reach the local server`,
      );
    // Radar lists tickets not yet tasks, and plans one with Commander.
    await tab
      .getByRole("button", { name: /^Radar/ })
      .first()
      .click();
    // A long meeting location never makes the list wider than the pane.
    await tab
      .getByText("Harness long-place meeting")
      .waitFor({ timeout: 5000 })
      .catch(() => undefined);
    const wide = await tab.evaluate(() =>
      [...document.querySelectorAll(".console-pane, .console-radar")].some(
        (el) => el.scrollWidth > el.clientWidth + 1,
      ),
    );
    if (wide) problems.push(`${at}: a Radar meeting is wider than the pane`);
    // Radar opens on Meetings; tickets are the second view.
    await tab.getByRole("button", { name: "Tickets", exact: true }).click();
    const ticket = tab.getByText("Harness board item", { exact: true });
    if (
      !(await ticket
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false))
    )
      problems.push(`${at}: Radar shows no ticket`);
    else {
      await tab
        .getByRole("button", { name: /^Actions for KF-9/ })
        .first()
        .click();
      await tab.getByRole("menuitem", { name: "Plan with Commander" }).click();
      await tab.waitForTimeout(200);
      const planned = (
        (await tab.evaluate(
          () => (window as unknown as { __calls?: Calls }).__calls ?? [],
        )) as Calls
      ).some(
        (c) =>
          c.tool === "commander_plan" && /KF-9/.test(JSON.stringify(c.args)),
      );
      if (!planned)
        problems.push(
          `${at}: Plan with Commander did not reach commander_plan`,
        );
      // The filter shows the tickets that are already tasks.
      await tab
        .getByRole("button", { name: /^Filter for the ticket list/ })
        .click();
      await tab
        .getByRole("menuitemcheckbox", { name: /Show tickets that are tasks/ })
        .click();
      if (
        !(await tab
          .getByText("Harness board item with a task", { exact: true })
          .waitFor({ timeout: 3000 })
          .then(() => true)
          .catch(() => false))
      )
        problems.push(`${at}: the filter does not show tickets that are tasks`);
    }
    // Beam lists what waits on the operator, and sends an answer.
    await tab.getByRole("button", { name: /^Beam/ }).first().click();
    const ask = tab.getByRole("button", { name: /Which day suits the review/ });
    if (
      !(await ask
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false))
    )
      problems.push(`${at}: Beam shows no ask`);
    else {
      await ask.click();
      await tab.getByRole("radio", { name: /Thursday/ }).check();
      await tab.getByRole("button", { name: "Send", exact: true }).click();
      await tab.waitForTimeout(300);
      const answered = (
        (await tab.evaluate(
          () => (window as unknown as { __calls?: Calls }).__calls ?? [],
        )) as Calls
      ).some(
        (c) =>
          c.tool === "commander_answer" &&
          /Thursday/.test(JSON.stringify(c.args)),
      );
      if (!answered)
        problems.push(`${at}: Beam's answer did not reach commander_answer`);
      // An answered ask leaves the list and the rail's count.
      await tab.waitForTimeout(1500);
      if (
        await tab
          .getByRole("button", { name: /Which day suits the review/ })
          .isVisible()
      )
        problems.push(`${at}: an answered ask still shows in Beam`);
      if (
        !(await tab
          .getByText(/1 hidden by the search or the filter/)
          .isVisible())
      )
        problems.push(`${at}: Beam does not say the answered ask is hidden`);
    }
    // A claimed task links to its agent.
    await tab
      .getByRole("button", { name: /^Missions/ })
      .first()
      .click();
    await tab
      .getByRole("button", { name: /Harness second task/ })
      .first()
      .click()
      .catch(() => undefined);
    const agentLink = tab.getByRole("button", {
      name: "Ops Desk",
      exact: true,
    });
    if (
      !(await agentLink
        .waitFor({ timeout: 3000 })
        .then(() => true)
        .catch(() => false))
    )
      problems.push(`${at}: a claimed task does not link to its agent`);
    else {
      await agentLink.click();
      if (
        !(await tab
          .getByRole("heading", { name: "Ops Desk" })
          .waitFor({ timeout: 3000 })
          .then(() => true)
          .catch(() => false))
      )
        problems.push(`${at}: the agent link does not open the agent`);
    }
    // Agents lists who is online by machine, hides the offline, and nudges.
    await tab
      .getByRole("button", { name: /^Agents/ })
      .first()
      .click();
    if (
      !(await tab
        .getByText("Ops Desk", { exact: true })
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false))
    )
      problems.push(`${at}: Agents shows no agent`);
    if (await tab.getByText("Gone Agent", { exact: true }).isVisible())
      problems.push(`${at}: Agents shows an offline agent`);
    await tab.getByRole("button", { name: /^Actions for Ops Desk/ }).click();
    await tab.getByRole("menuitem", { name: "Nudge" }).click();
    await tab.waitForTimeout(300);
    const nudged = (
      (await tab.evaluate(
        () => (window as unknown as { __calls?: Calls }).__calls ?? [],
      )) as Calls
    ).some((c) => c.tool === "agent_message" && c.args.nudge === true);
    if (!nudged) problems.push(`${at}: Nudge did not reach agent_message`);
    // The agent's detail shows its live view and its open messages.
    await tab
      .getByRole("button", { name: /^Ops Desk/ })
      .first()
      .click();
    if (
      !(await tab
        .getByRole("img", { name: /^Live view: now at Shell/ })
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false))
    )
      problems.push(`${at}: the agent has no live view`);
    if (
      !(await tab
        .getByText(/Done: the depot alerts/)
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false))
    )
      problems.push(`${at}: the agent's messages are missing`);
    if (process.env.SHOTS)
      await tab.screenshot({
        path: join(process.env.SHOTS, `agent-${size.width}.png`),
      });
    if (await tab.getByText("Keep the old queue a week?").isVisible())
      problems.push(`${at}: an answered question shows with the filter off`);
    await tab.getByText("Move the alerts tonight or tomorrow?").click();
    if (
      !(await tab
        .getByRole("heading", { name: "Beam", level: 1 })
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false))
    )
      problems.push(`${at}: an open question does not open Beam`);
    // Log lists what was finished, with its points.
    await tab.getByRole("button", { name: /^Log/ }).first().click();
    if (
      !(await tab
        .getByText("Harness finished today", { exact: true })
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false))
    )
      problems.push(`${at}: Log shows no finished task`);
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
  await tab.setContent(wrapPage(source, CLAIMED), { waitUntil: "load" });
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

  // A host without the log: Log says why instead of reading for ever.
  const noLog = await browser.newPage({
    viewport: { width: 466, height: 700 },
  });
  await noLog.route("**/*", (route) => route.abort());
  await noLog.setContent(
    wrapPage(source, CLAIMED)
      .replace('"host:dashboard/task_log"', '"host:dashboard/task_log_missing"')
      .replace('"host:dashboard/agents"', '"host:dashboard/agents_missing"'),
    { waitUntil: "load" },
  );
  await noLog.getByRole("button", { name: /^Log/ }).first().click();
  await noLog.waitForTimeout(1500);
  if (await noLog.getByText("Reading the log…").isVisible())
    problems.push("no log: Log keeps reading when the host has no log");
  // The same host without the agent list: Agents says why, not "none online".
  await noLog
    .getByRole("button", { name: /^Agents/ })
    .first()
    .click();
  await noLog.waitForTimeout(1500);
  if (await noLog.getByText("No agent is online.").isVisible())
    problems.push(
      "no agents: Agents claims none is online when it could not read them",
    );
  if (
    !(await noLog
      .getByText(/agent list comes from the dashboard server|dashboard server/i)
      .first()
      .isVisible())
  )
    problems.push("no agents: Agents does not say why it shows none");
  await noLog.close();
} finally {
  await browser.close();
}

if (problems.length) {
  console.error(`✗ console harness:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `✓ one file, ${Math.round(source.length / 1024)} KB; sidebar, folding phone closed and open, and laptop render with no errors; Status to Done, Grade, Move, Radar's Plan, a Beam answer, an Agents nudge, an agent's live view and messages, the Log (and without one), the task detail with its page and pull request, Shields and an offline move work`,
);
