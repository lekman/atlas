import type { Voices } from "../types";

/** A whistled bird call, wood knocks, a woodpecker, an owl and a branch crack. */
export const woodsmanVoices: Voices = {
  message: (synthesiser) => {
    synthesiser.tone(2100, 0.11, { gain: 0.06, glideTo: 2900 });
    synthesiser.tone(2700, 0.18, { gain: 0.05, at: 0.15, glideTo: 1900 });
  },
  status: (synthesiser) => {
    synthesiser.noise(0.05, { gain: 0.2, frequency: 850, q: 6 });
    synthesiser.tone(380, 0.07, { type: "triangle", gain: 0.05 });
  },
  external: (synthesiser) => {
    // A woodpecker: a quick run of knocks that speeds up and fades.
    let at = 0;
    for (let knock = 0; knock < 8; knock++) {
      synthesiser.noise(0.025, {
        gain: 0.26 - knock * 0.02,
        frequency: 1600,
        q: 8,
        at,
      });
      at += 0.07 - knock * 0.004;
    }
  },
  needs: (synthesiser) => {
    // An owl: a short hoot, then a longer, lower one.
    synthesiser.tone(392, 0.32, { gain: 0.13, glideTo: 370, lowPass: 900 });
    synthesiser.tone(349, 0.7, {
      gain: 0.12,
      at: 0.48,
      glideTo: 311,
      lowPass: 900,
    });
  },
  blocked: (synthesiser) => {
    // A branch cracks, and a low drum answers.
    synthesiser.noise(0.12, { gain: 0.32, frequency: 320, q: 0.8 });
    synthesiser.tone(72, 0.9, { gain: 0.15, at: 0.06, glideTo: 52 });
  },
};
