/**
 * The web app: the full Atlas view on the server's data, kept current by
 * the event stream. Served by the Atlas server from the same origin, so it
 * needs no address or key of its own. When the task database changes, the
 * server says so on the stream and the page loads the dataset again.
 */
import "@atlas/ui/fonts";
import "@atlas/ui/atlas.css";

import type { Dataset } from "@atlas/core";
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
    const show = (current: Dataset) =>
      root.render(
        <StrictMode>
          <AtlasShell
            dataset={current}
            // One world while Astronomer is refined; the others come back later.
            worlds={["astronomer"]}
            initialMode="full"
            remember
            subscribe={link.subscribe}
            onEvent={link.report}
          />
        </StrictMode>,
      );
    // The task database changed: load the dataset again. AtlasShell resets
    // its scene when the dataset it is given changes.
    const reload = () =>
      loadSnapshot()
        .then((snapshot) => show(link.catchUp(snapshot)))
        .catch(() => console.warn("the dataset did not reload"));
    const link = createLiveLink(sequence, undefined, undefined, reload);
    show(dataset);
  })
  .catch(() =>
    message("Atlas could not reach its server. Reload to try again."),
  );
