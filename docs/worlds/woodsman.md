# Woodsman

A printed trail map, the kind folded into a rucksack pocket. Clearings sit
in patchy woodland, brown contour lines ring each hill, two rivers wind
between them, and dashed trails run from Base Camp to every clearing. The
map has a neat line with grid ticks, a north arrow and a scale bar. The
rules every world keeps are in
[.claude/rules/worlds.md](../../.claude/rules/worlds.md).

## Mapping

| Record         | Woodsman                  | Drawn as                                                       |
| -------------- | ------------------------- | -------------------------------------------------------------- |
| Map            | Trail map                 | Woodland tint, tree symbols, contours, rivers, dashed trails   |
| Home           | **Base Camp**             | Five tents around a camp fire with a small flame, and a flag   |
| Client         | Clearing                  | An open meadow with a dotted edge and a signpost by the trail  |
| Requirement    | Waymark                   | A summit triangle on a small knoll, at the end of a spur path  |
| Backlog item   | Cairn                     | A stack of stones; how far it is built shows its state         |
| Agent          | Scout                     | A hiker pictogram in a disc of the status colour, boot prints  |
| Open question  | Unmarked fork             | A path that splits in two, in mist, with a question mark       |
| Decision       | Blazed tree               | A tall pine with a stripe of white paint on its trunk          |
| Agent to agent | Bird call                 | A bird flying a dotted path between two scouts                 |
| Outside system | Runner from the trailhead | A runner on a dashed path from the edge of the map             |
| Log            | Field notes               | Short, plain lines: "Bird call from Schema to Gaps watch: ..." |

A cairn shows the item's state: loose stones for to do, two stones stacked
for doing, three for review, and a faded full cairn for done. A pennant on a
stick marks a high-priority cairn, in ink rather than a status colour.

## Status Names

| Status   | Woodsman                    |
| -------- | --------------------------- |
| running  | on the trail                |
| watching | on lookout                  |
| waiting  | waiting at the fork for you |
| blocked  | lost                        |
| error    | turned back                 |
| idle     | at camp                     |

The pictogram changes a little with the status: a scout on the trail walks
with a stick and faces the way it is going, a scout on lookout shades its
eyes, a scout waiting for you raises an arm, and a scout that turned back
faces the other way. The colour of the disc carries the status; the pose
only adds to it. Waiting, lost and turned-back scouts, and forks that ask
you, carry a pulsing ring that holds still under reduced motion.

## Sound

| Cue            | Woodsman                            |
| -------------- | ----------------------------------- |
| Agent to agent | A whistled bird call, up then down  |
| Status change  | A soft wood knock                   |
| Outside system | A woodpecker, a quick run of knocks |
| Needs you      | An owl: a short hoot, then a long   |
| Blocked        | A branch cracks, a low drum answers |

## Palette

The ground is pale paper. Status inks keep the shared hue families,
deepened so each reads as text. Ratios are WCAG contrast against the ground
and against the panel (`rgba(249, 247, 238, 0.96)` over the ground, which
composites to `#f9f7ee`).

| Role     | Colour    | Hue | Against ground | Against panel |
| -------- | --------- | --: | -------------: | ------------: |
| ground   | `#f3f0e2` |     |                |               |
| ink      | `#23261c` |  78 |        13.46:1 |       14.33:1 |
| mute     | `#5a5847` |  54 |         6.29:1 |        6.70:1 |
| accent   | `#5f3f22` |  29 |         8.27:1 |        8.81:1 |
| running  | `#2d6a30` | 123 |         5.71:1 |        6.08:1 |
| watching | `#1c5e98` | 208 |         5.92:1 |        6.30:1 |
| waiting  | `#8e5200` |  35 |         5.47:1 |        5.83:1 |
| blocked  | `#b0241b` |   4 |         5.90:1 |        6.28:1 |
| error    | `#b0241b` |   4 |         5.90:1 |        6.28:1 |
| idle     | `#67655a` |  51 |         5.12:1 |        5.46:1 |

The terrain inks (woodland tint, tree green, contour brown, river blue,
tent canvas, flame) are never used as text. Map labels carry a paper halo,
so they stay readable where they cross trees or contours.

## Typefaces

| Role    | Family           | Weights     | Used for                                         |
| ------- | ---------------- | ----------- | ------------------------------------------------ |
| Display | Barlow Condensed | 600         | Clearing names and Base Camp, in spaced capitals |
| Body    | Bitter           | 400, italic | Everything else: labels, the log, the readout    |

Barlow Condensed has the narrow, upright look of trail signs and park
lettering. Bitter is a sturdy slab serif that stays legible at small sizes
on textured paper, and its italic sets river names and status lines the
way printed maps set water and notes. Both are served from `@fontsource`,
three files in all.

## Design Notes

- **Woodland is patchy.** The tint is built from a circle round every tree,
  so open ground shows as bare paper between the woods, as on a real
  survey map. Every clearing keeps woodland round it, so it reads as a
  clearing rather than a gap.
- **The paper is clean where the work is.** Clearings and the knolls under
  waymarks are knocked out of the wood and the contours, and client names
  are printed inside their clearing. Base Camp's name sits above the camp,
  because its waymark is below.
- **Rivers and trails come from the layout.** Rivers meander, then are
  pushed clear of every client's work, so they never run through a
  clearing in either orientation. A footbridge is drawn where a trail
  crosses water.
- **Statuses read at overview zoom.** A scout is a solid disc of its status
  colour with a white figure, edged in paper and ink, so it stands out on
  trees, contours and water alike.
- **The corner readout has a cartouche.** On wide screens a framed paper box
  sits under it, as a printed map frames its title, so the readout never
  sits on tree symbols.
- **Reduced motion.** The flame, the mist, the bird's wings, boot prints and
  every pulse hold still; status changes still show as a ring.
- **The still map** draws each clearing with its contours and woodland, and
  Base Camp with three tents and the fire.
