# Doctor

A medical district at night, seen from above, drawn like a wayfinding map.
Each client is a hospital on its own city block: a main building with a
helipad on its roof, wings out to its departments, an ambulance bay and a
car park. Home is The Practice, a small clinic inside a ring road at the
centre of town. Main roads run from the ring out to every hospital; a grid
of quiet streets, a river and two small parks fill the rest. When one agent
messages another, an ambulance drives the streets between their hospitals.

It is a map of work, not of patients. See [Cautions](#cautions) before
changing a shape or a word.

## Mapping

| Record         | Doctor              | Drawn as                                                                      |
| -------------- | ------------------- | ----------------------------------------------------------------------------- |
| Map            | Medical district    | A town plan at night: street grid, city blocks with lit windows, river, parks |
| Home           | **The Practice**    | A small clinic with a hipped roof, its own car park and a blue-and-white sign |
| Client         | Hospital            | A building complex on its own block, with a helipad, ambulance bay, car park  |
| Requirement    | Department          | An annex at the end of a wing, with a desk at its centre; a tick when done    |
| Backlog item   | Admission           | A bed: empty to do, in use doing, half made review, made and faded done       |
| Agent          | Staff member        | An upright identity badge in the status colour, with faint footsteps          |
| Open question  | Pending test result | A test tube with a lilac sample and a small question mark                     |
| Decision       | Recorded diagnosis  | A signed chart on a clipboard; the signature writes itself as it appears      |
| Agent to agent | Ambulance run       | An ambulance drives the streets from bay to bay; a porter within one hospital |
| Outside system | Air ambulance       | A helicopter flies in from the edge of the map and lands on the helipad       |
| Log            | Dispatch log        |                                                                               |

A high-priority admission has a second frame around its bed. Admissions
that serve no department wait in a small Admissions annex near the front of
the hospital (Reception, at The Practice). Idle staff gather on the main
block, in the staff room.

## Status Names

| Status   | Doctor              |
| -------- | ------------------- |
| running  | on rounds           |
| watching | monitoring          |
| waiting  | needs your sign-off |
| blocked  | on hold             |
| error    | escalated           |
| idle     | in the staff room   |

## Roads and Routes

The roads are worked out from the shared layout in
`packages/worlds/src/doctor/streets.ts`, so they follow it in landscape and
portrait alike.

- **The ring.** The Practice sits inside a square ring road at the centre.
- **Spokes.** Each hospital's ambulance bay sits in the one gap the layout
  leaves clear, between its departments and its admissions. A drive runs
  from the bay to the street the hospital fronts, and a main road (the
  hospital's spoke) runs from there along city streets, turning at right
  angles, to the ring. A spoke depends only on the hospital's centre, so the
  still SVG map draws exactly the same main roads as the live map.
- **The grid.** Every main road, every street midway between two hospitals
  and every street beside one becomes a grid line across the whole town;
  lines too close together merge, wide gaps get extra streets, and nothing
  runs through a hospital's grounds or The Practice's block.
- **Routing.** An ambulance takes the shortest route over the street graph
  (Dijkstra's algorithm), a little cheaper along main roads, with a cost for
  every turn so it takes the straight way rather than a staircase. Routes
  are worked out once per pair of places and kept.

## Motion

- **Ambulance run.** The route is drawn faintly, a dotted line hands over
  from the sending staff member to its bay, and the ambulance drives out of
  the bay, along the streets and round the corners, into the far bay. It
  faces the way it is going, and its light bar flashes white and violet
  (the accent), never a status colour. Within one hospital a porter's
  trolley runs a dashed corridor between the two staff members instead.
- **Air ambulance.** A helicopter with three rotor blades flies in from
  beyond the edge of the screen, comes down onto the hospital's helipad (or
  beside The Practice), and a dotted line runs from the pad to the record
  the news is for.
- **The Practice.** One window brightens and dims slowly, and the light by
  the door glows.
- **Reduced motion.** Nothing drives, flies, flashes or turns. A run shows
  its route drawn faintly with the ambulance parked at the destination bay
  for as long as the run would last; an air ambulance stands on its pad with
  its rotor still. Beds hold their places, footsteps are not drawn, and
  needs-you rings stay, unmoving.

## Sound

All cues are short, quiet and played once.

| Cue            | Doctor                                                     |
| -------------- | ---------------------------------------------------------- |
| Agent to agent | A soft two-note siren motif, high then low, under a second |
| Status change  | A single soft blip                                         |
| Outside system | A soft rotor thump, five low beats fading out              |
| Needs you      | A three-note public-address chime, rising, C, E and G      |
| Blocked        | A low double tone, falling, filtered and quiet             |

## Palette

The panel colour is `rgba(14, 21, 38, 0.94)`, which over the ground comes
to `#0e1526`. Contrast is the WCAG ratio against each.

| Role     | Colour    | Hue | Against ground | Against panel |
| -------- | --------- | --- | -------------- | ------------- |
| Ground   | `#0b1120` |     |                |               |
| Ink      | `#e7ecf7` |     | 15.91          | 15.37         |
| Mute     | `#95a3bd` |     | 7.40           | 7.15          |
| Accent   | `#cfa3ff` | 269 | 9.27           | 8.96          |
| Running  | `#72e27e` | 126 | 11.56          | 11.18         |
| Watching | `#62b5ff` | 208 | 8.58           | 8.30          |
| Waiting  | `#ffb547` | 36  | 10.72          | 10.36         |
| Blocked  | `#ff6070` | 354 | 6.42           | 6.20          |
| Error    | `#ff6070` | 354 | 6.42           | 6.20          |
| Idle     | `#94a1a7` | 199 | 7.10           | 6.86          |
| Sample   | `#dccbff` | 260 | 12.58          | 12.16         |

The accent is a soft violet, well clear of every status hue: it outlines
the hospitals, lights the helipads and flashes on the ambulances. The rest
of the town's decoration (lit windows, street lights, road markings) is a
dim warm white. Parks and the river are dark enough that their tint never
reads as a status. The Practice's sign is a deep blue plate with white
letters, far darker than the blue of "monitoring".

## Typefaces

| Role          | Face                       | Weights  |
| ------------- | -------------------------- | -------- |
| Display, body | Atkinson Hyperlegible Next | 400, 500 |
| Monospace     | Atkinson Hyperlegible Mono | 400      |

Atkinson Hyperlegible was drawn for readers with low vision. Its letters
are hard to confuse with one another, which suits wayfinding signs read at
a glance, and its plain, calm shapes keep the map quiet. Both families are
on Google Fonts and are served from `@fontsource`.

## Design Choices

- **A town, not a diagram.** Blocks, streets, a river with bridges and lit
  windows make the map read as a district at the overview zoom, before any
  label is legible. The town is kept dim so it never competes with the work.
- **Signs stay readable.** Each hospital's name sits on a plate just inside
  the top of its grounds, towards the outer side, in the band the layout
  leaves clear. The plate is drawn last so nothing covers it, and it never
  grows wider than the grounds: the detail goes first, then the letters
  shrink. The compact map shows names only.
- **Vehicles follow roads.** An ambulance never cuts across a block. That
  is what makes a message read as a journey between two places.
- **Status stays shared.** The badge colour is the shared Atlas status hue,
  and anything that needs the reader carries the same pulsing ring as in
  every other world. There is no separate triage colour scheme.

## Cautions

- **No protected emblems.** The Red Cross, Red Crescent and Red Crystal are
  protected under the Geneva Conventions, and the Star of Life is a
  registered mark. Nothing in this world draws a cross shape of any kind,
  in any colour: the helipad carries a plain "H", the ambulance carries
  chevrons, the helicopter has three rotor blades rather than four.
- **No real brands.** No hospital, ambulance service, device,
  pharmaceutical or software brand, logo, livery or interface is drawn or
  copied. Vehicles carry no text.
- **Clearly a metaphor.** Some readers work in healthcare and may share
  their screen with clinical colleagues. The words avoid alarming clinical
  terms ("code", "critical", "alarm", "emergency"); the message cue is two
  soft notes, not a siren; and nothing on the map resembles patient data:
  beds are empty shapes, with no names, numbers or readings anywhere.
