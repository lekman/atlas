import "@atlas/ui/console/fonts";

import { Runtime } from "@atlas/runtime";
import { createRoot } from "react-dom/client";

import { config, withoutConnectors } from "../config";
import { ConsoleApp } from "./ConsoleApp";

const root = document.getElementById("console");
if (root) {
  const runtime = Runtime.fromWindow(window);
  // As the sidebar does: served by the Atlas server, the page has a runtime
  // but no claude.ai connectors, so panels that need one are left out.
  const pageConfig =
    runtime.present && !runtime.connectors ? withoutConnectors(config) : config;
  createRoot(root).render(<ConsoleApp runtime={runtime} config={pageConfig} />);
}
