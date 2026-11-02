import "@atlas/ui/sidebar/fonts";
// The full page's styles, for its settings panel on the settings screen.
import "@atlas/ui/atlas.css";
import "./page.css";

import { Runtime } from "@atlas/runtime";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const root = document.getElementById("sidebar");
if (root) createRoot(root).render(<App runtime={Runtime.fromWindow(window)} />);
