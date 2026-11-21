/**
 * Copies the Atlas Console build into the vault, where the VS Code
 * extension (lekman/ai-toolkit packages/vscode-planner) reads it as
 * `_Dashboard Sync/console.html` and Obsidian Sync carries it to the other
 * Macs. Run `bun run publish:vault` after `build:console`; the folder comes
 * from ATLAS_VAULT_SYNC, so no path or client name is kept here.
 */
import { copyFileSync, existsSync, statSync } from "node:fs";
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
