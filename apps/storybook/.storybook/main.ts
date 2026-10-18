import type { StorybookConfig } from "@storybook/react-vite";

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve addon package paths absolutely. In a Bun workspace the packages
// hoist to the repository root node_modules, where Storybook's relative
// resolution can miss them.
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  addons: [
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-vitest"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
  // The stories live beside their components in the shared UI library. This
  // app only configures, tests and publishes them.
  stories: [
    "../../../packages/ui/src/**/*.mdx",
    "../../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  // Relative asset URLs in the production build, so the static site works
  // when GitHub Pages serves it under the repository's subpath.
  viteFinal: (viteConfig, { configType }) => {
    if (configType === "PRODUCTION") viteConfig.base = "./";
    return viteConfig;
  },
};

export default config;
