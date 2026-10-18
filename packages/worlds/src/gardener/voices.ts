import type { Voices } from "../types";

/** A bee's buzz, a trowel tap, rain patter, a wind chime and a low thud. */
export const gardenerVoices: Voices = {
  message: (synthesiser) => {
    // Two detuned saws, filtered soft, gliding up and away: a bee passing.
    synthesiser.tone(196, 0.42, {
      type: "sawtooth",
      gain: 0.035,
      glideTo: 247,
      lowPass: 900,
    });
    synthesiser.tone(203, 0.42, {
      type: "sawtooth",
      gain: 0.03,
      glideTo: 238,
      lowPass: 900,
    });
    synthesiser.tone(1568, 0.5, { gain: 0.035, at: 0.32 });
  },
  status: (synthesiser) => {
    // Steel on a clay pot: a short bright knock with a ringing edge.
    synthesiser.noise(0.035, { gain: 0.2, frequency: 3200, q: 6 });
    synthesiser.tone(1870, 0.12, { type: "triangle", gain: 0.05 });
  },
  external: (synthesiser) => {
    // Rain arriving: soft drops, closer together as the shower comes in.
    for (const [at, frequency] of [
      [0, 4200],
      [0.13, 3600],
      [0.22, 4600],
      [0.3, 3900],
      [0.36, 4400],
      [0.41, 3500],
      [0.46, 4100],
      [0.5, 3800],
    ] as const) {
      synthesiser.noise(0.025, { gain: 0.16, frequency, q: 3, at });
    }
    synthesiser.noise(0.6, { gain: 0.03, frequency: 2400, q: 0.7, at: 0.12 });
  },
  needs: (synthesiser) => {
    // A wind chime: three notes of a pentatonic scale, touched in turn.
    synthesiser.bell(1047, { gain: 0.09 });
    synthesiser.bell(1319, { at: 0.2, gain: 0.08 });
    synthesiser.bell(1568, { at: 0.42, gain: 0.07 });
    synthesiser.bell(1175, { at: 0.75, gain: 0.06 });
  },
  blocked: (synthesiser) => {
    // A full watering can set down hard: a low thud and a muffled knock.
    synthesiser.tone(82, 0.5, { gain: 0.3, glideTo: 46 });
    synthesiser.noise(0.12, { gain: 0.14, frequency: 220, q: 1.2 });
  },
};
