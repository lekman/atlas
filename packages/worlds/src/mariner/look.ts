import type { WorldLook } from "../types";
import {
  marinerNightPalette,
  marinerPalette,
  marinerTypefaces,
} from "./palette";
import { marinerVoices } from "./voices";

/** Mariner's name, colours, typefaces and voices, without its painter. */
export const marinerLook = {
  id: "mariner",
  name: "Mariner",
  description:
    "An engraved sea chart. Clients are islands, agents are ships under sail, home is Turtle Bay.",
  palette: marinerPalette,
  night: {
    name: "Night watch",
    description:
      "The chart on deep navy by moonlight: every lighthouse lit and sweeping, ships showing masthead lights, Turtle Bay's windows aglow.",
    palette: marinerNightPalette,
  },
  typefaces: marinerTypefaces,
  voices: marinerVoices,
} satisfies WorldLook;
