import "@atlas/ui/sidebar/fonts";
// The full page's styles, for its settings panel on the settings screen.
import "@atlas/ui/atlas.css";
import "./page.css";

import { Runtime } from "@atlas/runtime";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const root = document.getElementById("sidebar");
if (root) {
  const runtime = Runtime.fromWindow(window);
  // The host decides whether this page is the sidebar or a details tab, so
  // it is asked first. Only VS Code has one, and it answers at once.
  runtime
    .host()
    .then((host) =>
      createRoot(root).render(<App runtime={runtime} host={host} />),
    );
}
