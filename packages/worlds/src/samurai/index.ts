import type { World } from "../types";
import { samuraiPainter } from "./canvas";
import { samuraiPhrases, samuraiReadout, samuraiStillMap } from "./language";
import {
  samuraiNightPalette,
  samuraiPalette,
  samuraiTypefaces,
} from "./palette";
import { samuraiStatusNames, samuraiVocabulary } from "./vocabulary";
import { samuraiVoices } from "./voices";

export const samurai: World = {
  id: "samurai",
  name: "Samurai",
  description:
    "An ink-wash campaign scroll. Clients are clans, agents are retainers carrying banners, decisions are seals, home is The Castle.",
  vocabulary: samuraiVocabulary,
  statusNames: samuraiStatusNames,
  palette: samuraiPalette,
  night: {
    name: "Ninja",
    description:
      "The scroll by moonlight: lanterns lit at The Castle and every clan, retainers in dark garb with their banners still bright.",
    palette: samuraiNightPalette,
  },
  typefaces: samuraiTypefaces,
  painter: samuraiPainter,
  voices: samuraiVoices,
  phrases: samuraiPhrases,
  readout: samuraiReadout,
  stillMap: samuraiStillMap,
};
