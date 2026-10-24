# Worlds

A world is a full metaphor: it changes what things are called, how they are
drawn and how they sound. It never changes what needs the reader. The rules
every world keeps are in [.claude/rules/worlds.md](../.claude/rules/worlds.md).

## Built

Six worlds are built. Astronomer and Mariner are the first release. Most
have a page of their own with the palette, typefaces, night and design
choices: [Mariner](worlds/mariner.md), [Woodsman](worlds/woodsman.md),
[Gardener](worlds/gardener.md), [Samurai](worlds/samurai.md) and
[Doctor](worlds/doctor.md).

| World      | Home                      | Map                                            |
| ---------- | ------------------------- | ---------------------------------------------- |
| Astronomer | **Terra**, drawn as Earth | Star chart, grid, range rings, HUD             |
| Mariner    | **Turtle Bay**            | Engraved sea chart, soundings, compass rose    |
| Woodsman   | **Base Camp**             | Trail map, contour lines, rivers               |
| Gardener   | **The Homestead**         | Planting plan inside a hedge                   |
| Samurai    | **The Castle**            | Ink-wash campaign scroll                       |
| Doctor     | **The Practice**          | Medical district: hospitals, roads, ambulances |

### Records

| Record         | Astronomer           | Mariner      | Woodsman                  |
| -------------- | -------------------- | ------------ | ------------------------- |
| Client         | Star system          | Island       | Clearing                  |
| Requirement    | Planet               | Anchorage    | Waymark                   |
| Workstream     | Space station        | Buoy         | Signpost                  |
| Backlog item   | Moon                 | Cargo        | Cairn                     |
| Agent          | Probe                | Vessel       | Scout                     |
| Agent at work  | Mining laser         | Fishing line | Beside the cairn          |
| Launch vessel  | Launch               | Tender       | Apprentice                |
| Open question  | Comet                | Fog bank     | Unmarked fork             |
| Decision       | Charted star         | Lighthouse   | Blazed tree               |
| Agent to agent | Tight beam           | Signal flags | Bird call                 |
| Outside system | Inbound transmission | Telegram     | Runner from the trailhead |
| Log            | Comms log            | Ship's log   | Field notes               |

| Record         | Gardener        | Samurai        | Doctor              |
| -------------- | --------------- | -------------- | ------------------- |
| Client         | Bed             | Clan           | Hospital            |
| Requirement    | Seed row        | Objective      | Department          |
| Workstream     | Cold frame      | Camp           | Ward                |
| Backlog item   | Plant           | Campaign       | Admission (a bed)   |
| Agent          | Bee             | Retainer       | Staff member        |
| Agent at work  | Hovering at it  | Beside it      | At the bedside      |
| Launch vessel  | Forager         | Attendant      | Trainee             |
| Open question  | Dandelion clock | Scout's report | Pending test result |
| Decision       | Trellis         | Seal           | Recorded diagnosis  |
| Agent to agent | Pollen drift    | Messenger      | Ambulance run       |
| Outside system | Weather         | Courier        | Air ambulance       |
| Log            | Garden diary    | Chronicle      | Dispatch log        |

### Status Names

| Status   | Astronomer  | Mariner                    | Woodsman                    |
| -------- | ----------- | -------------------------- | --------------------------- |
| running  | underway    | under sail                 | on the trail                |
| watching | scanning    | on watch                   | on lookout                  |
| waiting  | hailing you | at anchor, awaiting orders | waiting at the fork for you |
| blocked  | adrift      | becalmed                   | lost                        |
| error    | hull fault  | aground                    | turned back                 |
| idle     | docked      | in port                    | at camp                     |

| Status   | Gardener            | Samurai               | Doctor              |
| -------- | ------------------- | --------------------- | ------------------- |
| running  | tending             | on campaign           | on rounds           |
| watching | keeping watch       | keeping watch         | monitoring          |
| waiting  | waiting for you     | awaiting your command | needs your sign-off |
| blocked  | parched             | besieged              | on hold             |
| error    | blighted            | wounded               | escalated           |
| idle     | resting in the hive | at rest               | in the staff room   |

### How Work Is Drawn

A client's work is grouped by workstream. Each workstream is a marker
beside its client, in two columns either side of it in landscape and one
column through it in portrait. Beside each marker sit at most five items,
the most urgent first: high priority before normal before low, then the
earliest planned day, with unscheduled work last. The marker's caption
counts the rest ("Quality · 3 more"). Work with no workstream gathers at a
marker called Unsorted, in every world.

Only work in progress or in review, or planned for a day and not done, is
drawn. Requirements sit in the space between the columns, decisions close
in to the client, and an open question floats left of the marker of the
item it blocks.

### How Agents Work

A running agent works its task. It flies to a spot beside the item and
holds there, facing it. The spot is to the item's right, above its row in
the upper half of the client and below it in the lower half, so the agent
covers neither the item nor its label. An agent working several items
works each for 20 seconds, then flies to the next, and round again. In
Astronomer the probe mines its moon with a laser, with sparks and
fragments drifting off. In Mariner the vessel lies alongside its cargo and
fishes it, a line to a bobbing float with ripples spreading round it. The
other worlds park the agent beside its item.

A waiting, blocked or failed agent parks beside its first item, with no
laser or line. A watching agent still circles its client, and an idle one
docks at it. Under reduced motion the agent stays at its first item, does
not hover, and the laser or line is drawn still. The still SVG map draws
the laser or line as a plain line.

### How Vessels Launch

A foreground agent is a ship. A background agent or subagent it starts is
a launch vessel: the same craft at a little over half the size. In
Astronomer a probe launches a launch, in Mariner a ship lowers a tender,
and the other four worlds send out a smaller scout, bee, retainer or
staff member.

A vessel leaves from its parent, flies to its task and works it as an
agent does: a finer laser in Astronomer, a finer line and float in
Mariner, parked beside the item in the other worlds. Agents keep their
spots when a vessel arrives. A vessel takes the next spot beside its task
that is clear of every spot an agent keeps, and whose laser or line
passes no other agent. A vessel with no task holds close behind its
parent. A faint dotted line ties each vessel to its parent. When the
vessel returns, it flies back to its parent and leaves the map as it
arrives. Its record is gone from the moment it returns.

A vessel's name shows only when zoomed in on its client, and its status
only closer still, so vessels do not crowd the map. The client's count of
agents leaves vessels out. Under reduced motion a vessel is placed at its
spot at once and leaves at once; the launch and the return each show as a
ring, on the vessel and on its parent. The still SVG map draws a vessel
as a smaller dot at its spot.

## Day and Night

Lighting follows the device by default, so Atlas goes dark when the Mac or
the iPhone does; the world picker can fix Day or Night instead. Each world
draws its night in its own way.

| World      | At night                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------- |
| Astronomer | Always dark                                                                                   |
| Mariner    | Night watch: a navy chart by moonlight, every lighthouse lit and sweeping, masthead lights    |
| Woodsman   | No night mode yet                                                                             |
| Gardener   | Night garden: lanterns along the paths, lit cottage windows, fireflies, moonflowers           |
| Samurai    | Ninja: the scroll by moonlight, lanterns at the castle and every clan, retainers in dark garb |
| Doctor     | Night shift: lit windows, street lights along the main roads, ambulance lights in the streets |

## Sound

| Cue            | Astronomer                 | Mariner            | Woodsman           |
| -------------- | -------------------------- | ------------------ | ------------------ |
| Agent to agent | Two-tone chirp             | Morse pips         | Whistled bird call |
| Status change  | Soft blip                  | Wood knock         | Soft wood knock    |
| Outside system | Static and a rising tone   | Telegraph clicks   | Woodpecker         |
| Needs you      | Descending three-note call | Ship's bell, twice | Owl                |
| Blocked        | Low hum                    | Foghorn            | Branch crack, drum |

| Cue            | Gardener              | Samurai           | Doctor                          |
| -------------- | --------------------- | ----------------- | ------------------------------- |
| Agent to agent | Passing bee, chime    | Breathy flute     | Soft two-note siren motif       |
| Status change  | Trowel on a clay pot  | Wooden clapper    | Soft blip                       |
| Outside system | Rain patter           | Two taiko strikes | Soft rotor thump                |
| Needs you      | Wind chime            | Temple bell       | Three-note public-address chime |
| Blocked        | Watering can set down | Drum roll         | Low falling double tone         |

### Background

Three dark, slow ambiences play behind the map: **Android Rain** (detuned
brass pads in minor chords, rain and a low drone), **Nexus Tower** (a sub
drone, a slow filter sweep and distant metal bells) and **Outer Worlds**
(an evolving drone and a lonely gliding lead). They are synthesised in
the browser like the cues, so no recording needs a licence and nothing is
fetched, and they never repeat exactly. A background is off by default.
It plays only while sound is on, has its own volume, and is chosen in the
settings panel behind the cog. The Sound button turns all sound on and
off. Both are remembered in the browser; a browser still waits for the
first click or tap after a load before it plays.

## Planned

None. A new world starts in `plannedWorlds` in
`packages/worlds/src/planned.ts`, where the picker lists it as planned.

## Adding a World

1. Create `packages/worlds/src/<world>/` with `vocabulary.ts`,
   `palette.ts`, `canvas.ts`, `voices.ts` and `index.ts`.
2. Add it to `worlds` in `packages/worlds/src/index.ts` and remove it from
   `plannedWorlds`.
3. Give it a `stillMap` in `language.ts`: the home and client shapes the
   still SVG map draws, and where their labels sit. `svg.ts` is shared and
   needs no change.
4. Run `bun test packages/worlds`: the tests fail if a record type or a
   status is unnamed, or a status colour leaves its hue family.
5. Check every story in the new world with the toolbar's **World** control,
   and run `task test:stories` for contrast.
