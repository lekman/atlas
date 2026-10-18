import type { Voices } from "../types";

/**
 * Soft, rounded tones, short and quiet. The message cue hints at a siren in
 * two gentle notes and stops; nothing here repeats, climbs or pulses the way
 * a real siren or a piece of equipment does.
 */
export const doctorVoices: Voices = {
  /** A single soft blip. */
  status: (synthesiser) =>
    synthesiser.tone(880, 0.07, { gain: 0.07, lowPass: 2400 }),
  /** An ambulance run: two soft notes, high then low, once. */
  message: (synthesiser) => {
    synthesiser.tone(740, 0.24, {
      type: "triangle",
      gain: 0.05,
      glideTo: 770,
      lowPass: 1800,
    });
    synthesiser.tone(587, 0.32, {
      type: "triangle",
      gain: 0.045,
      at: 0.26,
      glideTo: 570,
      lowPass: 1800,
    });
  },
  /** An air ambulance: a soft rotor thump, fading out. */
  external: (synthesiser) => {
    for (let beat = 0; beat < 5; beat++) {
      const fade = 1 - beat * 0.17;
      synthesiser.tone(72, 0.1, {
        gain: 0.09 * fade,
        at: beat * 0.12,
        glideTo: 55,
        lowPass: 260,
      });
      synthesiser.noise(0.06, {
        gain: 0.025 * fade,
        frequency: 180,
        q: 0.8,
        at: beat * 0.12,
      });
    }
  },
  /** A public-address chime: three notes, rising, played once. */
  needs: (synthesiser) => {
    synthesiser.tone(523.25, 0.8, { gain: 0.07 });
    synthesiser.tone(659.25, 0.8, { gain: 0.065, at: 0.28 });
    synthesiser.tone(783.99, 1.2, { gain: 0.06, at: 0.56 });
  },
  /** A low double tone, falling. */
  blocked: (synthesiser) => {
    synthesiser.tone(196, 0.32, {
      type: "triangle",
      gain: 0.08,
      lowPass: 700,
    });
    synthesiser.tone(165, 0.45, {
      type: "triangle",
      gain: 0.07,
      at: 0.34,
      lowPass: 700,
    });
  },
};
