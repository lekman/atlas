import "@atlas/ui/sidebar/fonts";
import "./page.css";

import { Runtime } from "@atlas/runtime";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const root = document.getElementById("sidebar");
if (root) createRoot(root).render(<App runtime={Runtime.fromWindow(window)} />);
