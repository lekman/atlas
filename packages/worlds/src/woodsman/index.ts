import type { World } from "../types";
import { woodsmanPainter } from "./canvas";
import { woodsmanPhrases, woodsmanReadout, woodsmanStillMap } from "./language";
import { woodsmanPalette, woodsmanTypefaces } from "./palette";
import { woodsmanStatusNames, woodsmanVocabulary } from "./vocabulary";
import { woodsmanVoices } from "./voices";

export const woodsman: World = {
  id: "woodsman",
  name: "Woodsman",
  description:
    "A printed trail map with contour lines. Clients are clearings, agents are scouts on the trails, home is Base Camp.",
  vocabulary: woodsmanVocabulary,
  statusNames: woodsmanStatusNames,
  palette: woodsmanPalette,
  typefaces: woodsmanTypefaces,
  painter: woodsmanPainter,
  voices: woodsmanVoices,
  phrases: woodsmanPhrases,
  readout: woodsmanReadout,
  stillMap: woodsmanStillMap,
};
