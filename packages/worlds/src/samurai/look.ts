import type { WorldLook } from "../types";
import {
  samuraiNightPalette,
  samuraiPalette,
  samuraiTypefaces,
} from "./palette";
import { samuraiVoices } from "./voices";

/** Samurai's name, colours, typefaces and voices, without its painter. */
export const samuraiLook = {
  id: "samurai",
  name: "Samurai",
  description:
    "An ink-wash campaign scroll. Clients are clans, agents are retainers carrying banners, decisions are seals, home is The Castle.",
  palette: samuraiPalette,
  night: {
    name: "Ninja",
    description:
      "The scroll by moonlight: lanterns lit at The Castle and every clan, retainers in dark garb with their banners still bright.",
    palette: samuraiNightPalette,
  },
  typefaces: samuraiTypefaces,
  voices: samuraiVoices,
} satisfies WorldLook;
