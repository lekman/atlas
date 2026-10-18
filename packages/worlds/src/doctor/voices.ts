import type { Voices } from "../types";

/**
 * Soft, rounded sine tones, short and quiet. Nothing here repeats, pulses
 * in bursts or climbs in pitch the way a real equipment alarm does.
 */
export const doctorVoices: Voices = {
  /** A single soft monitor blip. */
  status: (synthesiser) =>
    synthesiser.tone(880, 0.07, { gain: 0.08, lowPass: 2400 }),
  /** A two-note pager. */
  message: (synthesiser) => {
    synthesiser.tone(1175, 0.08, {
      type: "triangle",
      gain: 0.07,
      lowPass: 3200,
    });
    synthesiser.tone(1568, 0.11, {
      type: "triangle",
      gain: 0.06,
      at: 0.11,
      lowPass: 3200,
    });
  },
  /** A quiet data chirp as results arrive. */
  external: (synthesiser) => {
    synthesiser.tone(1400, 0.05, { gain: 0.04, glideTo: 2100 });
    synthesiser.tone(1900, 0.05, { gain: 0.035, at: 0.07, glideTo: 2700 });
  },
  /** A gentle three-note chime, rising, played once. */
  needs: (synthesiser) => {
    synthesiser.tone(523.25, 0.9, { gain: 0.08 });
    synthesiser.tone(659.25, 0.9, { gain: 0.075, at: 0.22 });
    synthesiser.tone(783.99, 1.2, { gain: 0.07, at: 0.44 });
  },
  /** A low double tone. */
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
