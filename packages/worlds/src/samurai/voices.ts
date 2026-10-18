import type { Voices } from "../types";

/** A breathy flute, a wooden clapper, a low drum, a temple bell and a drum roll. */
export const samuraiVoices: Voices = {
  message: (synthesiser) => {
    // Breath first, then two notes that bend up into pitch, as a bamboo flute does.
    synthesiser.noise(0.55, { gain: 0.035, frequency: 1700, q: 1.2 });
    synthesiser.tone(560, 0.42, {
      gain: 0.07,
      glideTo: 587,
      lowPass: 1600,
    });
    synthesiser.tone(745, 0.6, {
      gain: 0.06,
      at: 0.3,
      glideTo: 784,
      lowPass: 1600,
    });
    synthesiser.noise(0.4, { gain: 0.02, frequency: 2400, q: 1, at: 0.3 });
  },
  status: (synthesiser) => {
    synthesiser.noise(0.05, { gain: 0.2, frequency: 1150, q: 9 });
    synthesiser.tone(930, 0.05, { type: "triangle", gain: 0.05 });
  },
  external: (synthesiser) => {
    for (const [at, gain] of [
      [0, 0.32],
      [0.34, 0.24],
    ] as const) {
      synthesiser.tone(118, 0.55, { gain, at, glideTo: 62, lowPass: 500 });
      synthesiser.noise(0.07, { gain: 0.14, frequency: 180, q: 0.8, at });
    }
  },
  needs: (synthesiser) => {
    synthesiser.bell(330, { gain: 0.15 });
    synthesiser.tone(165, 2.4, { gain: 0.045 });
    synthesiser.bell(330, { at: 1.7, gain: 0.08 });
  },
  blocked: (synthesiser) => {
    for (let hit = 0; hit < 12; hit++) {
      const at = hit * 0.075 - hit * hit * 0.0012;
      synthesiser.tone(84, 0.22, {
        gain: 0.05 + hit * 0.012,
        at,
        glideTo: 58,
        lowPass: 380,
      });
    }
    synthesiser.tone(70, 1.1, {
      gain: 0.16,
      at: 0.82,
      glideTo: 46,
      lowPass: 300,
    });
  },
};
