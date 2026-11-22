/**
 * Copies the Atlas Console build into the vault, where the VS Code
 * extension (lekman/ai-toolkit packages/vscode-planner) reads it as
 * `_Dashboard Sync/console.html`. Obsidian Sync does not carry `.html`
 * files, so it also writes `Transfer console.html.md`: the page inside a
 * fence, with its size and SHA-256, for the other Macs to unpack. The folder
 * comes from ATLAS_VAULT_SYNC, so no path or client name is kept here.
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const folder = process.env.ATLAS_VAULT_SYNC;
if (!folder) {
  console.error(
    "Set ATLAS_VAULT_SYNC to the vault's _Dashboard Sync folder, then run again.",
  );
  process.exit(2);
}
if (!existsSync(folder) || !statSync(folder).isDirectory()) {
  console.error(`ATLAS_VAULT_SYNC is not a folder: ${folder}`);
  process.exit(2);
}
const built = join(import.meta.dir, "..", "dist-console", "console.html");
if (!existsSync(built)) {
  console.error("No console build; run bun run build:console first.");
  process.exit(2);
}
const target = join(folder, "console.html");
copyFileSync(built, target);
console.log(
  `console.html → ${target} (${Math.round(statSync(target).size / 1024)} KB)`,
);

// The transfer note: a fence longer than any run of backticks in the page.
const page = readFileSync(built, "utf8");
const longest = Math.max(0, ...(page.match(/`+/g) ?? []).map((r) => r.length));
const fence = "`".repeat(Math.max(3, longest + 1));
const bytes = Buffer.byteLength(page);
const sha = createHash("sha256").update(page).digest("hex");
const commit =
  Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"])
    .stdout.toString()
    .trim() || "unknown";
const note = [
  "---",
  "type: transfer",
  "file: console.html",
  `bytes: ${bytes}`,
  `sha256: ${sha}`,
  `source: lekman/atlas ${commit}, apps/sidebar build:console`,
  `fence: ${fence.length} backticks (longest run inside is ${longest})`,
  `created: ${new Date().toISOString().slice(0, 10)}`,
  "delete-after: unpacked on the other Macs",
  "---",
  "",
  "# Transfer: console.html",
  "",
  "Unpack everything between the fences, exactly, to `console.html` in this folder. Drop the newline that follows the opening fence and the one before the closing fence. Then check the bytes and SHA-256 above.",
  "",
  fence,
  page,
  fence,
  "",
].join("\n");
const transfer = join(folder, "Transfer console.html.md");
writeFileSync(transfer, note);
console.log(`transfer note → ${transfer} (sha256 ${sha.slice(0, 12)}…)`);
