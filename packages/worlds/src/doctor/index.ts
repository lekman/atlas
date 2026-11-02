import type { World } from "../types";
import { doctorLook } from "./look";
import { doctorPainter } from "./canvas";
import { doctorPhrases, doctorReadout, doctorStillMap } from "./language";
import { doctorStatusNames, doctorVocabulary } from "./vocabulary";

export const doctor: World = {
  ...doctorLook,
  vocabulary: doctorVocabulary,
  statusNames: doctorStatusNames,
  painter: doctorPainter,
  phrases: doctorPhrases,
  readout: doctorReadout,
  stillMap: doctorStillMap,
};
