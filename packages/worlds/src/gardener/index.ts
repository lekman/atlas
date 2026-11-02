import type { World } from "../types";
import { gardenerLook } from "./look";
import { gardenerPainter } from "./canvas";
import { gardenerPhrases, gardenerReadout, gardenerStillMap } from "./language";
import { gardenerStatusNames, gardenerVocabulary } from "./vocabulary";

export const gardener: World = {
  ...gardenerLook,
  vocabulary: gardenerVocabulary,
  statusNames: gardenerStatusNames,
  painter: gardenerPainter,
  phrases: gardenerPhrases,
  readout: gardenerReadout,
  stillMap: gardenerStillMap,
};
