import type { World } from "../types";
import { marinerLook } from "./look";
import { marinerPainter } from "./canvas";
import { marinerPhrases, marinerReadout, marinerStillMap } from "./language";
import { marinerStatusNames, marinerVocabulary } from "./vocabulary";

export const mariner: World = {
  ...marinerLook,
  vocabulary: marinerVocabulary,
  statusNames: marinerStatusNames,
  painter: marinerPainter,
  phrases: marinerPhrases,
  readout: marinerReadout,
  stillMap: marinerStillMap,
};
