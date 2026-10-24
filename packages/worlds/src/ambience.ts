/**
 * Background sound: three dark, slow ambiences synthesised in the browser,
 * so no audio file needs a licence and nothing is fetched. Off until the
 * reader picks one. A browser starts audio only after a click or a tap; the
 * player resumes its context on every call, so the first gesture after a
 * reload starts a remembered ambience.
 *
 * Each ambience runs until it is stopped and changes slowly over time:
 * chords and bells are scheduled on timers, never from a fixed recording.
 */

export const backgroundIds = [
  "android-rain",
  "nexus-tower",
  "outer-worlds",
] as const;
export type BackgroundId = (typeof backgroundIds)[number];
export type BackgroundChoice = BackgroundId | "off";

export interface Background {
  id: BackgroundId;
  name: string;
  /** One line on what it sounds like. */
  description: string;
}

export const backgrounds: readonly Background[] = [
  {
    id: "android-rain",
    name: "Android Rain",
    description:
      "Detuned brass pads in slow minor chords, rain and a low drone.",
  },
  {
    id: "nexus-tower",
    name: "Nexus Tower",
    description:
      "Colder: a sub drone, a slow filter sweep and distant metal bells.",
  },
  {
    id: "outer-worlds",
    name: "Outer Worlds",
    description:
      "Sparse: an evolving drone and a lonely gliding lead now and then.",
  },
];

export function isBackgroundChoice(value: unknown): value is BackgroundChoice {
  return value === "off" || backgroundIds.includes(value as BackgroundId);
}

export interface AmbiencePlayer {
  /** Plays a background, replacing the one playing; "off" stops it. */
  play(choice: BackgroundChoice, volume: number): void;
  setVolume(volume: number): void;
  stop(): void;
  /** What is playing, or "off". */
  current(): BackgroundChoice;
}

type AudioContextConstructor = new () => AudioContext;

function defaultContextFactory(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Constructor =
    (window as unknown as { AudioContext?: AudioContextConstructor })
      .AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext;
  return Constructor ? new Constructor() : null;
}

const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

/** A source of randomness, so tests and the fixed parts stay repeatable. */
type Random = () => number;

export function createAmbiencePlayer(
  makeContext: () => AudioContext | null = defaultContextFactory,
  random: Random = Math.random,
): AmbiencePlayer {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let input: GainNode | null = null;
  let playing: { choice: BackgroundId; stop(): void } | null = null;

  const ready = (): boolean => {
    if (!context) {
      context = makeContext();
      if (!context) return false;
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      input = context.createGain();
      const space = reverb(context, random);
      const wet = context.createGain();
      wet.gain.value = 0.75;
      const dry = context.createGain();
      dry.gain.value = 0.35;
      input.connect(space).connect(wet).connect(master);
      input.connect(dry).connect(master);
    }
    if (context.state === "suspended") void context.resume();
    return true;
  };

  const setVolume = (volume: number) => {
    if (!context || !master) return;
    master.gain.setTargetAtTime(
      Math.max(0, Math.min(1, volume)),
      context.currentTime,
      0.4,
    );
  };

  const stop = () => {
    playing?.stop();
    playing = null;
  };

  return {
    play(choice, volume) {
      if (choice === "off") {
        stop();
        return;
      }
      if (!ready() || !context || !input) return;
      setVolume(volume);
      if (playing?.choice === choice) return;
      stop();
      try {
        playing = { choice, stop: sketches[choice](context, input, random) };
      } catch {
        // A background that fails to start must never break the map.
        playing = null;
      }
    },
    setVolume,
    stop,
    current: () => playing?.choice ?? "off",
  };
}

type Sketch = (
  context: AudioContext,
  output: AudioNode,
  random: Random,
) => () => void;

/** A long, dark reverb from decaying, filtered noise. */
function reverb(context: AudioContext, random: Random, seconds = 7) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    for (let index = 0; index < length; index++) {
      last = last * 0.86 + (random() * 2 - 1) * 0.14;
      data[index] = last * Math.pow(1 - index / length, 2.6);
    }
  }
  const node = context.createConvolver();
  node.buffer = buffer;
  return node;
}

/** One brass-like voice: two detuned saws through a slow low-pass, swelling. */
function padVoice(
  context: AudioContext,
  output: AudioNode,
  frequency: number,
  start: number,
  length: number,
  brightness: number,
  random: Random,
  detune = 7,
) {
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(200, start);
  filter.frequency.linearRampToValueAtTime(brightness, start + length * 0.45);
  filter.frequency.linearRampToValueAtTime(260, start + length);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.09, start + length * 0.35);
  gain.gain.linearRampToValueAtTime(0.0001, start + length);
  filter.connect(gain).connect(output);
  for (const cents of [-detune, detune]) {
    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = cents;
    const vibrato = context.createOscillator();
    const depth = context.createGain();
    vibrato.frequency.value = 4.8 + random();
    depth.gain.value = 4;
    vibrato.connect(depth).connect(oscillator.detune);
    oscillator.connect(filter);
    oscillator.start(start);
    vibrato.start(start);
    oscillator.stop(start + length + 0.1);
    vibrato.stop(start + length + 0.1);
  }
}

/** A held drone with a very slow filter sweep. Returns its stop. */
function drone(
  context: AudioContext,
  output: AudioNode,
  note: number,
  level: number,
) {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(level, context.currentTime, 3);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 180;
  const sweep = context.createOscillator();
  const sweepDepth = context.createGain();
  sweep.frequency.value = 0.03;
  sweepDepth.gain.value = 90;
  sweep.connect(sweepDepth).connect(filter.frequency);
  filter.connect(gain).connect(output);
  const voices = [note, note + 0.06, note - 12].map((value) => {
    const oscillator = context.createOscillator();
    oscillator.type = value < note ? "sine" : "sawtooth";
    oscillator.frequency.value = midi(value);
    oscillator.connect(filter);
    oscillator.start();
    return oscillator;
  });
  sweep.start();
  return fadeOut(context, gain, [...voices, sweep]);
}

/** Rain: filtered noise, faded in. Returns its stop. */
function rain(
  context: AudioContext,
  output: AudioNode,
  level: number,
  random: Random,
) {
  const buffer = context.createBuffer(
    1,
    context.sampleRate * 4,
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index++)
    data[index] = random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2400;
  band.Q.value = 0.6;
  const low = context.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 6000;
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(level, context.currentTime, 4);
  source.connect(band).connect(low).connect(gain).connect(output);
  source.start();
  return fadeOut(context, gain, [source]);
}

/** Fades a gain to silence, then stops its sources. */
function fadeOut(
  context: AudioContext,
  gain: GainNode,
  sources: AudioScheduledSourceNode[],
) {
  return () => {
    gain.gain.setTargetAtTime(0, context.currentTime, 1.2);
    setTimeout(() => {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
      }
    }, 6000);
  };
}

/** Struck metal far away: inharmonic partials with long tails. */
function bell(
  context: AudioContext,
  output: AudioNode,
  frequency: number,
  when: number,
) {
  for (const [ratio, level] of [
    [1, 0.05],
    [2.76, 0.025],
    [5.4, 0.012],
    [8.93, 0.006],
  ] as const) {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency * ratio;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 6 / ratio + 1);
    oscillator.connect(gain).connect(output);
    oscillator.start(when);
    oscillator.stop(when + 8);
  }
}

/** A gliding lead, like a ribbon controller. */
function lead(
  context: AudioContext,
  output: AudioNode,
  notes: ReadonlyArray<readonly [number, number]>,
  when: number,
) {
  const oscillator = context.createOscillator();
  oscillator.type = "triangle";
  const gain = context.createGain();
  const vibrato = context.createOscillator();
  const depth = context.createGain();
  vibrato.frequency.value = 5.2;
  depth.gain.value = 9;
  vibrato.connect(depth).connect(oscillator.detune);
  let time = when;
  gain.gain.setValueAtTime(0.0001, time);
  for (const [note, length] of notes) {
    oscillator.frequency.setTargetAtTime(midi(note), time, 0.12);
    gain.gain.setTargetAtTime(0.05, time, 0.4);
    time += length;
  }
  gain.gain.setTargetAtTime(0.0001, time, 1.2);
  oscillator.connect(gain).connect(output);
  oscillator.start(when);
  vibrato.start(when);
  oscillator.stop(time + 6);
  vibrato.stop(time + 6);
}

/** Plays chords in turn, each swelling over `length` seconds, every `every` seconds. */
function chords(
  context: AudioContext,
  output: AudioNode,
  progression: readonly (readonly number[])[],
  length: number,
  every: number,
  brightness: number,
  random: Random,
  detune?: number,
) {
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const play = () => {
    const start = context.currentTime + 0.1;
    for (const note of progression[index % progression.length] ?? [])
      padVoice(
        context,
        output,
        midi(note),
        start,
        length,
        brightness,
        random,
        detune,
      );
    index++;
    timer = setTimeout(play, every * 1000);
  };
  play();
  return () => clearTimeout(timer);
}

const sketches: Record<BackgroundId, Sketch> = {
  "android-rain"(context, output, random) {
    const stops = [
      chords(
        context,
        output,
        [
          [50, 57, 62, 65],
          [46, 53, 58, 62],
          [48, 55, 60, 63],
          [45, 52, 57, 60],
        ],
        14,
        11,
        1400,
        random,
      ),
      drone(context, output, 38, 0.06),
      rain(context, output, 0.035, random),
    ];
    return () => stops.forEach((stop) => stop());
  },
  "nexus-tower"(context, output, random) {
    let bellTimer: ReturnType<typeof setTimeout> | undefined;
    const ring = () => {
      const notes = [69, 72, 76, 81];
      bell(
        context,
        output,
        midi(notes[Math.floor(random() * notes.length)] ?? 69),
        context.currentTime + 0.05,
      );
      bellTimer = setTimeout(ring, 7000 + random() * 9000);
    };
    bellTimer = setTimeout(ring, 4000);
    const stops = [
      chords(
        context,
        output,
        [
          [45, 52, 55, 60],
          [41, 48, 52, 57],
          [43, 50, 53, 58],
        ],
        18,
        15,
        900,
        random,
        11,
      ),
      drone(context, output, 33, 0.09),
      () => clearTimeout(bellTimer),
    ];
    return () => stops.forEach((stop) => stop());
  },
  "outer-worlds"(context, output, random) {
    const phrases: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
      [
        [69, 2.5],
        [72, 1.5],
        [71, 3],
        [67, 4],
      ],
      [
        [64, 2],
        [67, 2],
        [69, 5],
      ],
      [
        [72, 2],
        [71, 1.5],
        [69, 2],
        [64, 5],
      ],
    ];
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sing = () => {
      lead(
        context,
        output,
        phrases[index % phrases.length] ?? [],
        context.currentTime + 0.2,
      );
      index++;
      timer = setTimeout(sing, 26000 + random() * 12000);
    };
    timer = setTimeout(sing, 3000);
    const stops = [
      drone(context, output, 40, 0.08),
      drone(context, output, 47, 0.03),
      () => clearTimeout(timer),
    ];
    return () => stops.forEach((stop) => stop());
  },
};
