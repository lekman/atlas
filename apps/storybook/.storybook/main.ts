import type { StorybookConfig } from "@storybook/react-vite";

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve addon package paths absolutely. In a Bun workspace the packages
// hoist to the repository root node_modules, where Storybook's relative
// resolution can miss them.
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const configuration: StorybookConfig = {
  addons: [
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-vitest"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
  // Storybook reports usage to its makers unless told not to. A tool built
  // for privacy sends nothing it does not need to.
  //
  // The dev server answers only on loopback names unless told otherwise.
  // STORYBOOK_ALLOWED_HOSTS (comma-separated) adds the names a proxy in
  // front of it uses, such as a private network's host name, so this
  // public file names no machine.
  core: {
    disableTelemetry: true,
    ...(process.env.STORYBOOK_ALLOWED_HOSTS
      ? {
          allowedHosts: process.env.STORYBOOK_ALLOWED_HOSTS.split(",")
            .map((host) => host.trim())
            .filter(Boolean),
        }
      : {}),
  },
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

export default configuration;
