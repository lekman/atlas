import type { World } from "../types";
import { woodsmanLook } from "./look";
import { woodsmanPainter } from "./canvas";
import { woodsmanPhrases, woodsmanReadout, woodsmanStillMap } from "./language";
import { woodsmanStatusNames, woodsmanVocabulary } from "./vocabulary";

export const woodsman: World = {
  ...woodsmanLook,
  vocabulary: woodsmanVocabulary,
  statusNames: woodsmanStatusNames,
  painter: woodsmanPainter,
  phrases: woodsmanPhrases,
  readout: woodsmanReadout,
  stillMap: woodsmanStillMap,
};
