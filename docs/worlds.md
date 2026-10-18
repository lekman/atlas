# Worlds

A world is a full metaphor: it changes what things are called, how they are
drawn and how they sound. It never changes what needs the reader. The rules
every world keeps are in [.claude/rules/worlds.md](../.claude/rules/worlds.md).

## Built

| Record         | Astronomer                         | Mariner                                     |
| -------------- | ---------------------------------- | ------------------------------------------- |
| Map            | Star chart, grid, range rings, HUD | Engraved sea chart, soundings, compass rose |
| Home           | **Terra**, drawn as Earth          | **Turtle Bay**, a harbour island            |
| Client         | Star system                        | Island                                      |
| Requirement    | Planet                             | Anchorage                                   |
| Backlog item   | Moon, orbiting its planet          | Cargo                                       |
| Agent          | Probe with an ion trail            | Vessel with a wake                          |
| Open question  | Comet                              | Fog bank                                    |
| Decision       | Charted star                       | Lighthouse                                  |
| Agent to agent | Tight beam                         | Signal flags                                |
| Outside system | Inbound transmission               | Telegram                                    |
| Log            | Comms log                          | Ship's log                                  |

| Status   | Astronomer  | Mariner                    |
| -------- | ----------- | -------------------------- |
| running  | underway    | under sail                 |
| watching | scanning    | on watch                   |
| waiting  | hailing you | at anchor, awaiting orders |
| blocked  | adrift      | becalmed                   |
| error    | hull fault  | aground                    |
| idle     | docked      | in port                    |

## Sound

| Cue            | Astronomer                 | Mariner            |
| -------------- | -------------------------- | ------------------ |
| Agent to agent | Two-tone chirp             | Morse pips         |
| Status change  | Soft blip                  | Wood knock         |
| Outside system | Static and a rising tone   | Telegraph clicks   |
| Needs you      | Descending three-note call | Ship's bell, twice |
| Blocked        | Low hum                    | Foghorn            |

## Planned

| World    | Home                | Map                        |
| -------- | ------------------- | -------------------------- |
| Woodsman | Base Camp           | Trail map, contour lines   |
| Gardener | The Homestead       | Planting plan              |
| Samurai  | The Castle          | Ink-wash campaign scroll   |
| Doctor   | The Nurses' Station | Ward board, vitals monitor |

## Adding a World

1. Create `packages/worlds/src/<world>/` with `vocabulary.ts`,
   `palette.ts`, `canvas.ts`, `voices.ts` and `index.ts`.
2. Add it to `worlds` in `packages/worlds/src/index.ts` and remove it from
   `plannedWorlds`.
3. Teach the still map in `svg.ts` its client and home shapes.
4. Run `bun test packages/worlds`: the tests fail if a record type or a
   status is unnamed, or a status colour leaves its hue family.
5. Check every story in the new world with the toolbar's **World** control,
   and run `task test:stories` for contrast.
