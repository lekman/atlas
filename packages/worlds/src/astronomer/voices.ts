import type { Voices } from "../types";

/** Clean electronic tones, like a ship's console. */
export const astronomerVoices: Voices = {
  message: (synthesiser) => {
    synthesiser.tone(880, 0.09, { gain: 0.13 });
    synthesiser.tone(1320, 0.14, { gain: 0.1, at: 0.08 });
  },
  status: (synthesiser) =>
    synthesiser.tone(660, 0.08, { type: "triangle", gain: 0.1 }),
  external: (synthesiser) => {
    synthesiser.noise(0.28, { gain: 0.05, frequency: 2600, q: 0.8 });
    synthesiser.tone(520, 0.22, { gain: 0.09, at: 0.05, glideTo: 820 });
  },
  needs: (synthesiser) => {
    synthesiser.tone(784, 0.35, { gain: 0.12 });
    synthesiser.tone(587, 0.45, { gain: 0.11, at: 0.18 });
    synthesiser.tone(440, 0.7, { gain: 0.1, at: 0.36 });
  },
  blocked: (synthesiser) =>
    synthesiser.tone(118, 0.7, {
      type: "sawtooth",
      gain: 0.05,
      glideTo: 92,
      lowPass: 600,
    }),
};
