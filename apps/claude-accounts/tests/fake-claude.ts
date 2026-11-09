/**
 * A stand-in for the `claude` command in the command-line tests. It never
 * signs in to anything: `auth login` writes a marker file in
 * `CLAUDE_CONFIG_DIR`, `auth status --json` reads it, `auth logout` removes
 * it. Every call is appended to `FAKE_CLAUDE_LOG`.
 *
 * - `FAKE_CLAUDE_LOGIN_EMAIL`: the address the login ends up on, as if the
 *   owner picked another account in the browser. Default: `--email`.
 * - `FAKE_CLAUDE_ACCOUNT_ID`: the account id it writes. Default: from the address.
 * - `FAKE_CLAUDE_LOGIN_EXIT`: the login's exit code. Default 0.
 *
 * Its status output carries a field named like a secret, so the tests can
 * show that the command under test never repeats it.
 */
import {
  appendFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

export const FAKE_SECRET = "fake-secret-that-must-never-be-printed";

const folder = process.env.CLAUDE_CONFIG_DIR ?? "";
const args = process.argv.slice(2);
if (process.env.FAKE_CLAUDE_LOG)
  appendFileSync(
    process.env.FAKE_CLAUDE_LOG,
    `${basename(folder)} ${args.join(" ")}\n`,
  );

const marker = join(folder, ".fake-login");
const settingsPath = join(folder, ".claude.json");

function settings(): Record<string, unknown> {
  return existsSync(settingsPath)
    ? (JSON.parse(readFileSync(settingsPath, "utf8")) as Record<
        string,
        unknown
      >)
    : {};
}

const [group, command] = args;
if (group !== "auth") process.exit(2);

if (command === "status") {
  if (existsSync(marker)) {
    const login = JSON.parse(readFileSync(marker, "utf8")) as { email: string };
    console.log(
      JSON.stringify({
        loggedIn: true,
        authMethod: "claude.ai",
        email: login.email,
        orgId: "organisation-1",
        subscriptionType: "max",
        accessToken: FAKE_SECRET,
      }),
    );
    process.exit(0);
  }
  console.log(JSON.stringify({ loggedIn: false, authMethod: "none" }));
  process.exit(1);
}

if (command === "login") {
  const index = args.indexOf("--email");
  const email =
    process.env.FAKE_CLAUDE_LOGIN_EMAIL ??
    (index >= 0 ? args[index + 1] : undefined) ??
    "you@example.com";
  const code = Number(process.env.FAKE_CLAUDE_LOGIN_EXIT ?? 0);
  if (code !== 0) process.exit(code);
  const accountUuid =
    process.env.FAKE_CLAUDE_ACCOUNT_ID ?? `account-${email.toLowerCase()}`;
  writeFileSync(marker, JSON.stringify({ email }));
  writeFileSync(
    settingsPath,
    JSON.stringify({
      ...settings(),
      oauthAccount: { accountUuid, emailAddress: email },
    }),
  );
  console.log("Login successful.");
  process.exit(0);
}

if (command === "logout") {
  rmSync(marker, { force: true });
  const { oauthAccount: _removed, ...rest } = settings();
  writeFileSync(settingsPath, JSON.stringify(rest));
  process.exit(0);
}

process.exit(2);
