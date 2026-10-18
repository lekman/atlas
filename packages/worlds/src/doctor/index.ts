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
    "A ward board on monitor glass. Clients are wards, agents are staff on rounds, home is the Nurses’ Station.",
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
