/**
 * The web app: the full Atlas view on the server's data, kept current by
 * the event stream. Served by the Atlas server from the same origin, so it
 * needs no address or key of its own.
 */
import "@atlas/ui/fonts";
import "@atlas/ui/atlas.css";

import { AtlasShell } from "@atlas/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createLiveLink, loadSnapshot } from "./live";

const root = createRoot(document.getElementById("atlas")!);

function message(text: string) {
  root.render(
    <main className="atlas-page-message">
      <p>{text}</p>
    </main>,
  );
}

loadSnapshot()
  .then(({ dataset, sequence }) => {
    if (dataset.clients.length === 0) {
      message("Atlas has no records yet.");
      return;
    }
    const link = createLiveLink(sequence);
    root.render(
      <StrictMode>
        <AtlasShell
          dataset={dataset}
          // One world while Astronomer is refined; the others come back later.
          worlds={["astronomer"]}
          initialMode="full"
          remember
          subscribe={link.subscribe}
          onEvent={link.report}
        />
      </StrictMode>,
    );
  })
  .catch(() =>
    message("Atlas could not reach its server. Reload to try again."),
  );
