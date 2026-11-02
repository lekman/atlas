import type { World } from "../types";
import { astronomerLook } from "./look";
import { astronomerPainter } from "./canvas";
import {
  astronomerPhrases,
  astronomerReadout,
  astronomerStillMap,
} from "./language";
import { astronomerStatusNames, astronomerVocabulary } from "./vocabulary";

export const astronomer: World = {
  ...astronomerLook,
  vocabulary: astronomerVocabulary,
  statusNames: astronomerStatusNames,
  painter: astronomerPainter,
  phrases: astronomerPhrases,
  readout: astronomerReadout,
  stillMap: astronomerStillMap,
};
