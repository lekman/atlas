import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { fontsWoff2Only, inlineBundle } from "./build/inline";

const directory = import.meta.dirname;

/**
 * The config named by SIDEBAR_CONFIG, else this machine's own, else the
 * example. Checks build with the example, whatever the machine has.
 */
function sidebarConfig(): unknown {
  if (process.env.SIDEBAR_CONFIG) {
    return JSON.parse(
      readFileSync(join(directory, process.env.SIDEBAR_CONFIG), "utf8"),
    );
  }
  const own = join(directory, "sidebar.config.json");
  const file = existsSync(own)
    ? own
    : join(directory, "sidebar.config.example.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

export default defineConfig({
  root: directory,
  base: "./",
  plugins: [react(), fontsWoff2Only(), inlineBundle()],
  define: { __SIDEBAR_CONFIG__: JSON.stringify(sidebarConfig()) },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Everything ends up in the one HTML file: fonts and images as data
    // URIs, one script, one stylesheet.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
