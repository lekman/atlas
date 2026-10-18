import type { World } from "../types";
import { astronomerPainter } from "./canvas";
import { astronomerPalette, astronomerTypefaces } from "./palette";
import { astronomerStatusNames, astronomerVocabulary } from "./vocabulary";
import { astronomerVoices } from "./voices";

export const astronomer: World = {
  id: "astronomer",
  name: "Astronomer",
  description:
    "Star charts and tactical readouts. Clients are star systems, agents are probes in flight, home is Terra.",
  vocabulary: astronomerVocabulary,
  statusNames: astronomerStatusNames,
  palette: astronomerPalette,
  typefaces: astronomerTypefaces,
  painter: astronomerPainter,
  voices: astronomerVoices,
};
