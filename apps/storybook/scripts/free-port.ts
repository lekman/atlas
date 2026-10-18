/**
 * Frees a TCP port before Storybook binds it.
 *
 * Without this, a second `bun run storybook` finds 6006 taken and asks
 * whether to use another port. In a terminal that is a prompt to answer; in
 * a non-interactive shell it either hangs or silently moves the server to a
 * port nobody is looking at. Restarting to pick up a config change is
 * common enough that the old server should just go.
 *
 * Only the current user's own processes are killed, because that is all
 * `lsof` and `taskkill` are given the right to touch here. A port held by
 * another user fails the kill, and the message says so rather than the
 * start failing later for an unrelated-looking reason.
 */

const port = Number(Bun.argv[2] ?? 6006);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`free-port: ${Bun.argv[2]} is not a port number`);
  process.exit(1);
}

/** Process ids listening on the port, newest shell conventions per platform. */
async function listenersOn(p: number): Promise<number[]> {
  const command =
    process.platform === "win32"
      ? [
          "powershell",
          "-NoProfile",
          "-Command",
          `(Get-NetTCPConnection -LocalPort ${p} -State Listen -ErrorAction SilentlyContinue).OwningProcess`,
        ]
      : ["lsof", "-ti", `tcp:${p}`, "-sTCP:LISTEN"];

  // lsof exits 1 when nothing matches, which is the common case and not an
  // error. Anything it writes to stderr is swallowed for the same reason.
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;

  return [
    ...new Set(
      out
        .split(/\s+/)
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isInteger(pid) && pid > 0),
    ),
  ];
}

const pids = await listenersOn(port);

if (pids.length === 0) {
  process.exit(0);
}

for (const pid of pids) {
  // Never the current process or its parent: a shell that happens to match
  // would take the terminal down with it.
  if (pid === process.pid || pid === process.ppid) continue;

  try {
    if (process.platform === "win32") {
      Bun.spawnSync(["taskkill", "/PID", String(pid), "/F"], {
        stdout: "ignore",
        stderr: "ignore",
      });
    } else {
      process.kill(pid, "SIGTERM");
    }
    console.log(`free-port: stopped process ${pid} on port ${port}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `free-port: could not stop process ${pid} on port ${port}: ${reason}`,
    );
  }
}

// SIGTERM is asynchronous, so the socket can still be held when Storybook
// binds a moment later. Wait for the port to actually clear, and give up
// rather than hang if something holds it.
const deadline = Date.now() + 3000;
while (Date.now() < deadline) {
  if ((await listenersOn(port)).length === 0) process.exit(0);
  await Bun.sleep(100);
}

console.error(`free-port: port ${port} is still held; starting anyway`);

// A module, not a script. Top-level await needs one, and without an import
// or an export TypeScript reads this file as a script and refuses it.
export {};
