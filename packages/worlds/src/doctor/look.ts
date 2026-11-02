import type { WorldLook } from "../types";
import { doctorNightPalette, doctorPalette, doctorTypefaces } from "./palette";
import { doctorVoices } from "./voices";

/** Doctor's name, colours, typefaces and voices, without its painter. */
export const doctorLook = {
  id: "doctor",
  name: "Doctor",
  description:
    "A medical district seen from above. Clients are hospitals joined by roads, agents are staff on rounds, messages go by ambulance, home is The Practice.",
  palette: doctorPalette,
  night: {
    name: "Night shift",
    description:
      "The district after dark: lit windows, street lights along the main roads, ambulance lights in the streets.",
    palette: doctorNightPalette,
  },
  typefaces: doctorTypefaces,
  voices: doctorVoices,
} satisfies WorldLook;
