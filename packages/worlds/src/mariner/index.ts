import type { World } from "../types";
import { marinerPainter } from "./canvas";
import { marinerPhrases, marinerReadout, marinerStillMap } from "./language";
import {
  marinerNightPalette,
  marinerPalette,
  marinerTypefaces,
} from "./palette";
import { marinerStatusNames, marinerVocabulary } from "./vocabulary";
import { marinerVoices } from "./voices";

export const mariner: World = {
  id: "mariner",
  name: "Mariner",
  description:
    "An engraved sea chart. Clients are islands, agents are ships under sail, home is Turtle Bay.",
  vocabulary: marinerVocabulary,
  statusNames: marinerStatusNames,
  palette: marinerPalette,
  night: {
    name: "Night watch",
    description:
      "The chart on deep navy by moonlight: every lighthouse lit and sweeping, ships showing masthead lights, Turtle Bay's windows aglow.",
    palette: marinerNightPalette,
  },
  typefaces: marinerTypefaces,
  painter: marinerPainter,
  voices: marinerVoices,
  phrases: marinerPhrases,
  readout: marinerReadout,
  stillMap: marinerStillMap,
};
