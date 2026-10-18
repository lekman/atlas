import type { World } from "../types";
import { doctorPainter } from "./canvas";
import { doctorPhrases, doctorReadout, doctorStillMap } from "./language";
import { doctorPalette, doctorTypefaces } from "./palette";
import { doctorStatusNames, doctorVocabulary } from "./vocabulary";
import { doctorVoices } from "./voices";

export const doctor: World = {
  id: "doctor",
  name: "Doctor",
  description:
    "A medical district at night, seen from above. Clients are hospitals joined by roads, agents are staff on rounds, messages go by ambulance, home is The Practice.",
  vocabulary: doctorVocabulary,
  statusNames: doctorStatusNames,
  palette: doctorPalette,
  typefaces: doctorTypefaces,
  painter: doctorPainter,
  voices: doctorVoices,
  phrases: doctorPhrases,
  readout: doctorReadout,
  stillMap: doctorStillMap,
};
