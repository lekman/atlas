# Doctor

A hospital floor plan seen from above, drawn on the dark glass of a vitals
monitor. Each client is a ward, a rounded room on the plan with a door onto
a corridor that leads back to the Nurses’ Station at the centre. Along the
top wall of every ward runs a small monitor strip whose trace sweeps left to
right, faster and taller the more of the ward's staff are on rounds.

It is a ward board for work, not for patients. See
[Cautions](#cautions) before changing a shape or a word.

## Mapping

| Record         | Doctor                     | Drawn as                                                                 |
| -------------- | -------------------------- | ------------------------------------------------------------------------ |
| Map            | Ward board, vitals monitor | Floor plan on monitor glass: fine grid, double walls, doors, corridors   |
| Home           | **The Nurses’ Station**    | A U-shaped desk with a bank of small monitors and a clipboard            |
| Client         | Ward                       | A rounded room with a door, a staff room table and a monitor strip       |
| Requirement    | Care goal                  | A target disc inside a dashed curtain rail; a tick when done             |
| Backlog item   | Treatment step             | A checklist box: empty to do, filled doing, half filled review, ticked   |
| Agent          | Staff member               | An upright identity badge in the status colour, with faint footsteps     |
| Open question  | Pending lab result         | A test tube with a lilac sample and a small question mark                |
| Decision       | Recorded diagnosis         | A signed chart on a clipboard; the signature writes itself as it appears |
| Agent to agent | Page                       | A dashed line, a pager travelling along it and a short buzz on arrival   |
| Outside system | Lab feed                   | A line of small data blips running in from beyond the ward               |
| Log            | Ward log                   |                                                                          |

A high-priority treatment step carries a second frame around its box. The
idle staff of each ward gather at its staff room table in the middle of the
room.

## Status Names

| Status   | Doctor              |
| -------- | ------------------- |
| running  | on rounds           |
| watching | monitoring          |
| waiting  | needs your sign-off |
| blocked  | on hold             |
| error    | escalated           |
| idle     | in the staff room   |

## Sound

All cues are short, soft sine or triangle tones, played once.

| Cue            | Doctor                                         |
| -------------- | ---------------------------------------------- |
| Agent to agent | Two-note pager, rising                         |
| Status change  | A single soft monitor blip                     |
| Outside system | A quiet data chirp, two short upward glides    |
| Needs you      | A gentle three-note chime, rising, C, E and G  |
| Blocked        | A low double tone, falling, filtered and quiet |

## Palette

The panel colour is `rgba(12, 32, 37, 0.94)`, which over the ground comes
to `#0c1f24`. Contrast is the WCAG ratio against each.

| Role     | Colour    | Hue | Against ground | Against panel |
| -------- | --------- | --- | -------------- | ------------- |
| Ground   | `#07171b` |     |                |               |
| Ink      | `#dcefed` |     | 15.35          | 14.24         |
| Mute     | `#88a9a7` |     | 7.22           | 6.69          |
| Accent   | `#7ad6cf` | 175 | 10.76          | 9.98          |
| Running  | `#72e27e` | 126 | 11.24          | 10.42         |
| Watching | `#62b5ff` | 208 | 8.34           | 7.74          |
| Waiting  | `#ffb547` | 36  | 10.42          | 9.66          |
| Blocked  | `#ff6070` | 354 | 6.24           | 5.79          |
| Error    | `#ff6070` | 354 | 6.24           | 5.79          |
| Idle     | `#94a1a7` | 199 | 6.90           | 6.40          |
| Sample   | `#cdb8f2` | 262 | 10.23          | 9.49          |

Walls, corridors, the grid and the traces share one pale aqua (the accent),
kept dim. The green of "on rounds" is the only bright green on the floor,
so a monitor trace never competes with a running agent. Pending lab results
use a soft lilac that sits outside every status hue.

## Typefaces

| Role          | Face                       | Weights  |
| ------------- | -------------------------- | -------- |
| Display, body | Atkinson Hyperlegible Next | 400, 500 |
| Monospace     | Atkinson Hyperlegible Mono | 400      |

Atkinson Hyperlegible was drawn for readers with low vision. Its letters
are hard to confuse with one another, which suits a board read at a glance
from across a room, and its plain, calm shapes keep the screen quiet. Both
families are on Google Fonts and are served from `@fontsource`.

## Design Choices

- **A floor plan, not a chart.** Rooms, doors with their architect's swing,
  and corridors with a dashed guide line make the layout read as a building
  at the overview zoom, before any label is legible.
- **The trace shows activity, never a value.** No number is printed beside
  a trace. A ward with nobody active rests on a slow, low wave rather than a
  flat line, because a flat line reads as something far more serious than a
  quiet ward.
- **One sweep per strip.** Each ward's trace is drawn by a sweep that moves
  across its strip, the oldest part fading ahead of it. The station's small
  monitors repeat each ward's rhythm. Under reduced motion the traces, the
  footsteps and the drift all hold still; needs-you rings stay, unmoving.
- **Status stays shared.** The badge colour is the shared Atlas status hue,
  and anything that needs the reader carries the same pulsing ring as in
  every other world. There is no separate triage colour scheme.

## Cautions

- **No protected emblems.** The Red Cross, Red Crescent and Red Crystal are
  protected under the Geneva Conventions. Nothing in this world draws a
  cross shape of any kind, in any colour: the station is a desk, the goal is
  a target, the badge is a plain card.
- **No real brands.** No hospital, device, pharmaceutical or software brand,
  logo or interface is drawn or copied.
- **Clearly a metaphor.** Some readers work in healthcare and may share
  their screen with clinical colleagues. The words avoid alarming clinical
  terms ("code", "critical", "alarm"), the sounds avoid the bursts and
  climbing patterns of real equipment alarms, and nothing on the board
  resembles patient data: no patient names, no numbers beside traces, no
  readings.
