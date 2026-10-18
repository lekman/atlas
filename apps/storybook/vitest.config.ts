import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));

// Every story is a test: rendered in Chromium, play function run, checked
// with axe. See README.md for why this is the one place Vitest is used.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["../../packages/ui/src/**/*.{ts,tsx}"],
      exclude: [
        "../../packages/ui/src/**/*.stories.tsx",
        "../../packages/ui/src/stories/**",
        "../../packages/ui/src/index.ts",
      ],
    },
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(directory, ".storybook") }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
