import type { Voices } from "../types";

/** Morse, wood, telegraph, a ship's bell and a foghorn. */
export const marinerVoices: Voices = {
  message: (synthesiser) => {
    for (const [at, length] of [
      [0, 0.06],
      [0.1, 0.06],
      [0.32, 0.18],
    ] as const) {
      synthesiser.tone(720, length, {
        type: "square",
        gain: 0.035,
        at,
        lowPass: 1800,
      });
    }
  },
  status: (synthesiser) =>
    synthesiser.noise(0.06, { gain: 0.22, frequency: 700, q: 5 }),
  external: (synthesiser) => {
    for (const at of [0, 0.07, 0.14, 0.3, 0.37])
      synthesiser.noise(0.03, { gain: 0.25, frequency: 2200, q: 6, at });
  },
  needs: (synthesiser) => {
    synthesiser.bell(523);
    synthesiser.bell(523, { at: 0.9, gain: 0.12 });
  },
  blocked: (synthesiser) => {
    synthesiser.tone(98, 1.3, { type: "sawtooth", gain: 0.06, lowPass: 420 });
    synthesiser.tone(100, 1.3, { type: "sawtooth", gain: 0.05, lowPass: 420 });
  },
};
