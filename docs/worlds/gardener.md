# Gardener

A garden designer's planting plan: a top-down drawing in soft watercolour
washes and ink on cream paper. Beds edged with clipped box sit on a lawn
inside a hedge, gravel paths run out from The Homestead to each bed, and a
small cartouche in the corner names the plan and keys the growth stages.
Work grows from seed to bloom, and bees do the tending.

The rules every world keeps are in
[Rules Every World Keeps](../../.claude/rules/worlds.md). The code is in
`packages/worlds/src/gardener/`.

## Mapping

| Record         | Gardener                       | Drawn as                                                                                 |
| -------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Map            | Planting plan                  | Lawn inside a hedge, gravel paths, corner trees, a pond, a cartouche with a north point  |
| Home           | **The Homestead**, home garden | A fenced yard: cottage with a hipped roof and weathervane, kitchen garden, well, a hen   |
| Client         | Bed                            | A rounded square of soil wash, raked, edged with box; a straw skep at its heart          |
| Requirement    | Seed row                       | A ring of tilled earth with a sown drill, and a cream row marker at its centre           |
| Backlog item   | Plant                          | Grows with its state: seed (to do), sprout (doing), bud (review), bloom (done)           |
| Agent          | Bee                            | A bee in its status colour, banded in cream, with a dotted flight path behind it         |
| Open question  | Dandelion clock                | A seed head on a stalk leaning from the plant it holds up; answered, its seeds blow away |
| Decision       | Trellis                        | A fan trellis; once made, a clematis has climbed it                                      |
| Agent to agent | Pollen drift                   | A curve of pollen grains from one bee to the other                                       |
| Outside system | Weather                        | A raincloud comes in over the hedge and rains on the record, leaving ripples             |
| Log            | Garden diary                   |                                                                                          |

High priority work carries a small red-topped stake beside the plant, as
in the other worlds.

## Status Names

| Status   | Gardener            |
| -------- | ------------------- |
| running  | tending             |
| watching | keeping watch       |
| waiting  | waiting for you     |
| blocked  | parched             |
| error    | blighted            |
| idle     | resting in the hive |

Idle bees rest by the skep at the centre of their bed. Bees that are
tending loop around the plant they work on; bees keeping watch fly the
edge of the bed. Waiting, parched and blighted bees carry the pulsing ring,
and so does any dandelion clock asked of you.

## Sound

| Cue            | Gardener                                           |
| -------------- | -------------------------------------------------- |
| Agent to agent | A bee's buzz passing, then a soft chime            |
| Status change  | A trowel tapping a clay pot                        |
| Outside system | Rain patter, closer together as the shower arrives |
| Needs you      | A wind chime, four notes of a pentatonic scale     |
| Blocked        | A low thud, a full watering can set down           |

## Palette

Status inks keep the shared hue families, deepened to read as text on the
paper and in the panels. Contrast is WCAG 2 against the ground and against
the panel (`rgba(251, 248, 238, 0.96)` over the ground, `#fbf8ed`).

| Role     | Colour    | Hue | On ground | On panel  |
| -------- | --------- | --- | --------- | --------- |
| ground   | `#f4eedb` |     |           |           |
| ink      | `#262f20` | 96  | 11.99 : 1 | 13.04 : 1 |
| mute     | `#5a6149` | 77  | 5.58 : 1  | 6.08 : 1  |
| accent   | `#5b4785` | 259 | 6.74 : 1  | 7.34 : 1  |
| running  | `#276a33` | 131 | 5.66 : 1  | 6.16 : 1  |
| watching | `#1f5c99` | 210 | 5.94 : 1  | 6.46 : 1  |
| waiting  | `#8a5200` | 36  | 5.51 : 1  | 5.99 : 1  |
| blocked  | `#ad2a1f` | 5   | 5.79 : 1  | 6.30 : 1  |
| error    | `#ad2a1f` | 5   | 5.79 : 1  | 6.30 : 1  |
| idle     | `#66625a` | 40  | 5.23 : 1  | 5.69 : 1  |

The washes (lawn, soil, box, terracotta, lavender, water blue) are laid
down translucent and are listed as `washes` in `palette.ts`. They never
carry meaning on their own.

## Typefaces

| Slot    | Family              | Weights         | Used for                                         |
| ------- | ------------------- | --------------- | ------------------------------------------------ |
| display | Architects Daughter | 400             | Hand-lettered labels, bed name boards, the title |
| mono    | Architects Daughter | 400             | Panel titles, tags and the garden diary          |
| body    | Fraunces            | 400, 400 italic | Panel text, work labels, the bee count           |

Architects Daughter is lettering from an architect's drawing, which is what
a planting plan is. Fraunces is a soft old-style serif with the warmth of a
seed catalogue. Both are on Google Fonts and served from `@fontsource`.

## Design Choices

- **Bees, not gardeners.** A bee reads at ten pixels and has a heading,
  and its looping flight path is the motion trail. Its body takes the status
  colour with cream bands and sits on a soft paper halo, so a green bee
  stands clear of green foliage.
- **Plants grow with their state.** The legend in the cartouche shows the
  four stages with the real state under each, so the growth is never a
  guess. Plants are drawn a little larger at the overview zoom so the stages
  stay apart.
- **A dandelion clock for a question.** A bud would clash with the review
  stage. A dandelion clock is what you ask a question of, and blowing it is
  a kind way to show an answer arriving.
- **Name boards on the beds.** Each bed's name sits on a small board on its
  edge, so names stay clear of the hedge and of the work inside the bed.
- **Compact detail** draws only the names of the beds and of The
  Homestead; work labels follow the shared `labelScale` thresholds.
- **Reduced motion** stops the flight paths, the looping, the wing flutter,
  the hen, the smoke, the weathervane and the lily pads. Rings hold still.
- **Stale work wilts** is not drawn yet: a backlog item does not record how
  long it has been in its state, so there is nothing honest to wilt by.
