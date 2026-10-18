# Samurai

An ink-wash campaign scroll on warm rice paper. Brushed mountains, pines and
bands of mist fill the open country between the clans; gold leaf is kept for
a few accents; vermilion appears only on seals. The map is calm and mostly
empty, so what moves and what is marked stands out.

The code is in `packages/worlds/src/samurai/`. The rules every world keeps
are in [Rules Every World Keeps](../../.claude/rules/worlds.md).

## Mapping

| Record         | Samurai                       | Drawn as                                                                                      |
| -------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| Map            | Campaign scroll               | Rice paper, brushed mountain ranges, pines, drifting mist, gold flecks, a gold and ink border |
| Home           | **The Castle**, the home keep | A three-tier keep on a stone base, with gold-leaf clouds, two pines and falling petals        |
| Client         | Clan                          | A province: a pale wash inside one brushed, unclosed circle, with the clan's crest at centre  |
| Requirement    | Objective                     | A standard planted on a rise, with a dotted ring where its campaigns move                     |
| Backlog item   | Campaign                      | A stone on the board: black under way, white not begun, half and half in review               |
| Agent          | Retainer                      | A small figure in ink carrying a banner on its back; the banner is the status colour          |
| Open question  | Scout's report                | A tied scroll with a thin smoke signal rising from it                                         |
| Decision       | Seal                          | A square vermilion seal carrying a Latin initial                                              |
| Agent to agent | Messenger                     | A dashed brush line with a small scroll carried along it                                      |
| Outside system | Courier                       | Hoof marks from the border, then a drum signal: brushed rings spreading on arrival            |
| Log            | Chronicle                     | The log panel, in plain measured sentences                                                    |

A moving retainer leaves a trail drawn as one brush stroke, heavy where the
retainer is and lifting away behind.

A high-priority campaign carries a second thin ring around its stone. A
proposed decision is a dashed seal outline, not yet stamped. A won objective
is drawn faded and keeps its label until the reader zooms in.

## Status Names

| Status   | Samurai               | On the map                                                |
| -------- | --------------------- | --------------------------------------------------------- |
| running  | on campaign           | Green banner, moving, with a brush-stroke trail           |
| watching | keeping watch         | Blue banner, circling its clan                            |
| waiting  | awaiting your command | Amber banner and a pulsing ring                           |
| blocked  | besieged              | Red banner, a ring of stakes close around, a pulsing ring |
| error    | wounded               | Red banner torn and its pole leaning, and a pulsing ring  |
| idle     | at rest               | Grey banner furled against its pole                       |

Every pulsing ring sits on a steady thin ring of the same colour, so what
needs the reader is never missed between beats. Under reduced motion the
pulse, the banners, the petals, the mist, the smoke and the orbits all hold
still; the rings stay.

## Sounds

All synthesised through the `Synthesiser` interface, so no audio file needs
a licence.

| Cue            | Sound                                                       |
| -------------- | ----------------------------------------------------------- |
| Agent to agent | A breathy flute: noise for breath, two notes bending up     |
| Status change  | A soft wooden clapper                                       |
| Outside system | Two low taiko-like drum strikes                             |
| Needs you      | A temple-bell-like strike over a low hum, and a softer echo |
| Blocked        | A deep drum roll that quickens, then a heavy final strike   |

## Palette

The ground is `#f2ebdb`. Panels are `rgba(249, 245, 236, 0.96)`, which is
`#f9f5eb` over the ground. Every colour used as text reaches WCAG AA (4.5:1)
on both.

| Role                    | Colour    | Hue | On ground | On panel |
| ----------------------- | --------- | --- | --------- | -------- |
| ink                     | `#1e1b17` | 34  | 14.44     | 15.71    |
| mute                    | `#5c5447` | 37  | 6.28      | 6.83     |
| accent                  | `#5a3b6c` | 278 | 7.77      | 8.45     |
| running                 | `#2e6a3c` | 134 | 5.45      | 5.93     |
| watching                | `#245c93` | 210 | 5.84      | 6.35     |
| waiting                 | `#8a5200` | 36  | 5.38      | 5.85     |
| blocked and error       | `#a3221d` | 2   | 6.31      | 6.86     |
| idle                    | `#686156` | 37  | 5.15      | 5.60     |
| vermilion, seals only   | `#d0502a` | 14  | 3.64      | 3.96     |
| gold leaf, accents only | `#c09a48` | 41  | 2.22      | 2.42     |

Vermilion and gold leaf only decorate and are never used for text. The
accent is a deep purple, the old colour of rank, chosen because it belongs to
no status family: it marks the selection, focus and pressed buttons.

## Typefaces

| Role                      | Face                | Weights  |
| ------------------------- | ------------------- | -------- |
| Display and body          | Shippori Mincho     | 400, 600 |
| Small labels and readouts | Zen Kaku Gothic New | 500      |

Shippori Mincho is a Mincho face whose Latin letters keep the brush's
contrast between thick and thin strokes: refined and a little calligraphic,
yet plain enough to read at panel sizes. Zen Kaku Gothic New is a quiet sans
for the small uppercase labels and the readout, where a serif would blur.
Both are on Google Fonts and are served from `@fontsource`, importing only
the Latin subset so the large Japanese subsets never enter the build.

## Design Choices

- **Homage, not caricature.** The figures have no faces: a robe, a broad hat
  and a banner, in ink. Nothing is drawn as a stereotype of a person.
- **No real crests.** Each clan's crest is invented from its id
  (`crest.ts`): a ring, and inside it one of five plain geometric motifs
  (spokes, segments, chevrons, beads, bars) repeated three, five, six or
  seven times. Flowers, leaves, commas, four-fold arrangements, and a large
  bead circled by six or eight smaller ones, all common in real family
  crests, are left out on purpose. Beads come only in fives and sevens,
  around a ring rather than a bead.
- **No Japanese or Chinese characters.** A seal carries a Latin initial taken
  from the decision's title, and no text on the map is written in a script
  that might be wrong or meaningless.
- **Vermilion never reads as blocked.** Seals are small, square, still and
  placed beside a clan's crest. Blocked and error are an agent's own red: the
  banner it carries, a ring of stakes or a torn banner, and the pulsing ring.
  The seal's vermilion is also more orange (hue 14) than the blocked red
  (hue 2).
- **Brush strokes are simulated.** A stroke is a filled outline whose width
  follows a brush's pressure (`brush.ts`); low-alpha layers and a few dry
  passes give the ink-wash look without any image files.
- **Generous empty space.** Mountains are placed only where the country is
  far from every clan, and stay pale. In the compact sidebar map only clan
  names and The Castle are labelled, and they are drawn last so no retainer
  hides them.
- **Labels avoid the work.** A clan's name sits on the side of its province
  away from its objectives, and a seal's title reads away from the clan's
  centre, clear of the crest or the keep.
