/**
 * Sound, synthesised in the browser so no audio file needs a licence.
 *
 * Off until the reader turns it on, and never started without a click: the
 * audio context is created on the first `play` after `enabled` is set, which
 * a browser allows only after a user gesture anyway.
 */
import type { BackgroundChoice } from "./ambience";
import type { SoundCategory, SoundCue, Synthesiser, World } from "./types";

export interface SoundSettings {
  enabled: boolean;
  /** 0 to 1. */
  volume: number;
  categories: Record<SoundCategory, boolean>;
  /** The background ambience, or "off". Plays only while sound is on. */
  background: BackgroundChoice;
  /** 0 to 1, apart from the cue volume. */
  backgroundVolume: number;
}

export const defaultSoundSettings: SoundSettings = {
  enabled: false,
  volume: 0.5,
  categories: { message: true, status: true, external: true, needs: true },
  background: "off",
  backgroundVolume: 0.4,
};

/** Which switch governs each cue. "Blocked" sits under needs-you. */
export const cueCategory: Record<SoundCue, SoundCategory> = {
  message: "message",
  status: "status",
  external: "external",
  needs: "needs",
  blocked: "needs",
};

export interface SoundPlayer {
  play(world: World, cue: SoundCue, settings: SoundSettings): void;
  /** Play regardless of the category switches, for a preview button. */
  preview(world: World, cue: SoundCue, settings: SoundSettings): void;
}

type AudioContextConstructor = new () => AudioContext;

export function createSoundPlayer(
  makeContext: () => AudioContext | null = defaultContextFactory,
): SoundPlayer {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;

  const ready = (volume: number): Synthesiser | null => {
    if (!context) {
      context = makeContext();
      if (!context) return null;
      master = context.createGain();
      master.connect(context.destination);
    }
    if (context.state === "suspended") void context.resume();
    if (master) master.gain.value = volume;
    return context && master ? webAudioSynthesiser(context, master) : null;
  };

  const run = (world: World, cue: SoundCue, settings: SoundSettings) => {
    const synthesiser = ready(settings.volume);
    if (!synthesiser) return;
    try {
      world.voices[cue](synthesiser);
    } catch {
      // A sound that fails to play must never break the map.
    }
  };

  return {
    play(world, cue, settings) {
      if (!settings.enabled || !settings.categories[cueCategory[cue]]) return;
      run(world, cue, settings);
    },
    preview(world, cue, settings) {
      run(world, cue, settings);
    },
  };
}

function defaultContextFactory(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Constructor =
    (window as unknown as { AudioContext?: AudioContextConstructor })
      .AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext;
  return Constructor ? new Constructor() : null;
}

export function webAudioSynthesiser(
  context: AudioContext,
  output: AudioNode,
): Synthesiser {
  const tone: Synthesiser["tone"] = (frequency, duration, options = {}) => {
    const start = context.currentTime + (options.at ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.glideTo)
      oscillator.frequency.exponentialRampToValueAtTime(
        options.glideTo,
        start + duration,
      );
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(options.gain ?? 0.2, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    let node: AudioNode = oscillator;
    if (options.lowPass) {
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = options.lowPass;
      oscillator.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  };
  return {
    tone,
    noise(duration, options = {}) {
      const start = context.currentTime + (options.at ?? 0);
      const buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * duration),
        context.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index++)
        samples[index] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = options.frequency ?? 1200;
      filter.Q.value = options.q ?? 1;
      const gain = context.createGain();
      gain.gain.setValueAtTime(options.gain ?? 0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      source.start(start);
    },
    bell(frequency, options = {}) {
      // Inharmonic partials are what make a bell a bell rather than a chord.
      for (const [ratio, level] of [
        [1, 1],
        [2, 0.5],
        [2.76, 0.35],
        [5.4, 0.18],
      ] as const) {
        tone(frequency * ratio, 2.2 / ratio + 0.3, {
          gain: (options.gain ?? 0.16) * level,
          at: options.at ?? 0,
        });
      }
    },
  };
}
