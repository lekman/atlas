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
| Backlog item   | Moon                 | Cargo        | Cairn                     |
| Agent          | Probe                | Vessel       | Scout                     |
| Open question  | Comet                | Fog bank     | Unmarked fork             |
| Decision       | Charted star         | Lighthouse   | Blazed tree               |
| Agent to agent | Tight beam           | Signal flags | Bird call                 |
| Outside system | Inbound transmission | Telegram     | Runner from the trailhead |
| Log            | Comms log            | Ship's log   | Field notes               |

| Record         | Gardener        | Samurai        | Doctor              |
| -------------- | --------------- | -------------- | ------------------- |
| Client         | Bed             | Clan           | Hospital            |
| Requirement    | Seed row        | Objective      | Department          |
| Backlog item   | Plant           | Campaign       | Admission (a bed)   |
| Agent          | Bee             | Retainer       | Staff member        |
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
