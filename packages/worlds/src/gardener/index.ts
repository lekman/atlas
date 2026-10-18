import type { World } from "../types";
import { gardenerPainter } from "./canvas";
import { gardenerPhrases, gardenerReadout, gardenerStillMap } from "./language";
import { gardenerPalette, gardenerTypefaces } from "./palette";
import { gardenerStatusNames, gardenerVocabulary } from "./vocabulary";
import { gardenerVoices } from "./voices";

export const gardener: World = {
  id: "gardener",
  name: "Gardener",
  description:
    "A watercolour planting plan. Clients are beds, work grows from seed to bloom, agents are bees, home is The Homestead.",
  vocabulary: gardenerVocabulary,
  statusNames: gardenerStatusNames,
  palette: gardenerPalette,
  typefaces: gardenerTypefaces,
  painter: gardenerPainter,
  voices: gardenerVoices,
  phrases: gardenerPhrases,
  readout: gardenerReadout,
  stillMap: gardenerStillMap,
};
