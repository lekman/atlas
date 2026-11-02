import type { WorldLook } from "../types";
import { woodsmanPalette, woodsmanTypefaces } from "./palette";
import { woodsmanVoices } from "./voices";

/** Woodsman's name, colours, typefaces and voices, without its painter. */
export const woodsmanLook = {
  id: "woodsman",
  name: "Woodsman",
  description:
    "A printed trail map with contour lines. Clients are clearings, agents are scouts on the trails, home is Base Camp.",
  palette: woodsmanPalette,
  typefaces: woodsmanTypefaces,
  voices: woodsmanVoices,
} satisfies WorldLook;
