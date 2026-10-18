import type { World } from "../types";
import { marinerPainter } from "./canvas";
import { marinerPalette, marinerTypefaces } from "./palette";
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
  typefaces: marinerTypefaces,
  painter: marinerPainter,
  voices: marinerVoices,
};
