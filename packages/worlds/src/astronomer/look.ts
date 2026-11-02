import type { WorldLook } from "../types";
import { astronomerPalette, astronomerTypefaces } from "./palette";
import { astronomerVoices } from "./voices";

/** Astronomer's name, colours, typefaces and voices, without its painter. */
export const astronomerLook = {
  id: "astronomer",
  name: "Astronomer",
  description:
    "Star charts and tactical readouts. Clients are star systems, agents are probes in flight, home is Terra.",
  palette: astronomerPalette,
  typefaces: astronomerTypefaces,
  voices: astronomerVoices,
} satisfies WorldLook;
