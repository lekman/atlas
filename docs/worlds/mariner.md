# Mariner

An engraved sea chart: brown and blue ink on paper, with soundings, depth
contours, rhumb lines and a compass rose. Clients are islands, agents are
vessels, open questions are fog banks and decisions are lighthouses. Home is
Turtle Bay, a harbour island with a pier.

The rules every world keeps are in
[Rules Every World Keeps](../../.claude/rules/worlds.md). The code is in
`packages/worlds/src/mariner/`.

## Night

**Night watch.** The same chart by moonlight: deep navy water, engraving
and soundings in a faint pale blue, slate islands with pale coastlines, and
the compass rose faintly lit. Status inks keep their hue families and are
raised in lightness to read on the dark ground. Contrast is WCAG 2 against
the ground and against the panel (`rgba(18, 34, 54, 0.95)` over the ground,
`#122235`).

| Role     | Colour    | Hue | On ground | On panel  |
| -------- | --------- | --- | --------- | --------- |
| ground   | `#0d1a2b` |     |           |           |
| ink      | `#e9e3d3` | 44  | 13.66 : 1 | 12.59 : 1 |
| mute     | `#9eaebf` | 211 | 7.72 : 1  | 7.11 : 1  |
| accent   | `#8bbbe0` | 206 | 8.57 : 1  | 7.90 : 1  |
| running  | `#72c27c` | 128 | 8.10 : 1  | 7.47 : 1  |
| watching | `#6fb0ec` | 209 | 7.58 : 1  | 6.99 : 1  |
| waiting  | `#eda24a` | 32  | 8.22 : 1  | 7.58 : 1  |
| blocked  | `#ff8076` | 4   | 7.17 : 1  | 6.61 : 1  |
| error    | `#ff8076` | 4   | 7.17 : 1  | 6.61 : 1  |
| idle     | `#a7a9a6` | 100 | 7.39 : 1  | 6.81 : 1  |

### What Is Lit

Every light is warm white (`rgb(255, 240, 204)`), never the amber of
waiting, so a lit lamp is never read as a status.

| Light        | At night                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse   | Every lighthouse is lit: a lamp with a soft halo, and a beam that sweeps once every six seconds, each starting at its own angle. A proposed decision's beam is fainter than a made one's |
| New decision | The lighthouse flares as its question is answered, then settles to its lamp and beam                                                                                                     |
| Vessel       | A masthead light at the bow, clear of the sail that carries the status colour                                                                                                            |
| Turtle Bay   | Three lit windows and a harbour light at the pier head, with its reflection on the bay                                                                                                   |
| Fog bank     | Paler, as if moonlit, so it stays readable on the dark water                                                                                                                             |
| Moon         | A faint wash from above the chart and its reflection broken into short strokes on the water                                                                                              |
| Compass rose | A faint glow behind it, as a binnacle lamp gives                                                                                                                                         |

By day the lighthouses stay as they are: only a made decision shows its
lamp and beam. Under reduced motion every light is on and still, and each
beam stands at its own angle. Anything that needs the reader keeps its
pulsing ring at night, in the night palette's status colour.

The still SVG map draws night islands in slate on navy, with Turtle Bay's
pier light and windows lit.
