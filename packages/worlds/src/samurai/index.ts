import type { World } from "../types";
import { samuraiLook } from "./look";
import { samuraiPainter } from "./canvas";
import { samuraiPhrases, samuraiReadout, samuraiStillMap } from "./language";
import { samuraiStatusNames, samuraiVocabulary } from "./vocabulary";

export const samurai: World = {
  ...samuraiLook,
  vocabulary: samuraiVocabulary,
  statusNames: samuraiStatusNames,
  painter: samuraiPainter,
  phrases: samuraiPhrases,
  readout: samuraiReadout,
  stillMap: samuraiStillMap,
};
