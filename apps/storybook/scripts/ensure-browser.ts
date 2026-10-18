#!/usr/bin/env bun
/**
 * Puts the browser the story tests run in on this machine.
 *
 * Every story runs as a test in a real Chromium, so the browser has to be
 * there before Vitest starts. Playwright will not download it on demand.
 *
 * The system libraries are a separate matter. `--with-deps` shells out to
 * the platform package manager, under `sudo` when the process is not root,
 * so it belongs on a build machine and not on an engineer's laptop. The
 * pre-push hook runs this, and a git hook that asks for a password is a
 * git hook people learn to bypass. So the libraries are installed only
 * where `CI` is set, which on the self-hosted runner it always is.
 *
 * A second run is cheap: Playwright reports the browser as already
 * installed and exits.
 *
 * Playwright is run through `process.execPath`, the Bun binary already
 * running this file, rather than through a `bunx` on the path. The
 * self-hosted runner has no `bunx`, and spawning a command that is not
 * there fails with no output at all, which is how this cost a CI round.
 */
import { spawnSync } from "node:child_process";

const args = ["x", "playwright", "install"];
if (process.env.CI) args.push("--with-deps");
args.push("chromium-headless-shell");

console.log(`> ${process.execPath} ${args.join(" ")}`);
const result = spawnSync(process.execPath, args, { stdio: "inherit" });

if (result.error) {
  console.error(`Could not start Playwright: ${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  console.error(`Playwright was killed by ${result.signal}.`);
  process.exit(1);
}
process.exit(result.status ?? 1);
