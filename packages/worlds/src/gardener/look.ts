import type { WorldLook } from "../types";
import {
  gardenerNightPalette,
  gardenerPalette,
  gardenerTypefaces,
} from "./palette";
import { gardenerVoices } from "./voices";

/** Gardener's name, colours, typefaces and voices, without its painter. */
export const gardenerLook = {
  id: "gardener",
  name: "Gardener",
  description:
    "A watercolour planting plan. Clients are beds, work grows from seed to bloom, agents are bees, home is The Homestead.",
  palette: gardenerPalette,
  night: {
    name: "Night garden",
    description:
      "The garden by moonlight: lanterns along the paths and at every bed, lit windows at the Homestead, fireflies over the beds and moonflowers where work is done.",
    palette: gardenerNightPalette,
  },
  typefaces: gardenerTypefaces,
  voices: gardenerVoices,
} satisfies WorldLook;
