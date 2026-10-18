# Rules Every World Keeps

A world (Astronomer, Mariner, and those that follow) changes the vocabulary,
the shapes and the map style. It never changes what a reader needs to act
on. These rules hold for every world, and a new world is not merged until
its stories show each one.

## Status Looks the Same Everywhere

Running is green, watching is blue, needs-you is amber, blocked and error
are red, idle is grey. Anything that needs the reader also carries a pulsing
ring. A world may shift the exact shade to suit its ground (ink on a chart,
light on a star map), never the hue family.

Learning a new world must never mean relearning what is urgent.

## Buttons Keep Plain Words

Actions read Open session, Ask status, Answer, Dispatch, Pause, in every
world. The metaphor lives in nouns and pictures. A button that says "Hail
the probe" is a button someone presses without knowing what it does.

## The Real Term Is Always One Step Away

The Key panel lists the world's mapping. The inspector shows the real term
under the themed one ("Comet · open question"). Accessible names and
`alt` text use the real term.

## Motion Follows Events, and Stops When Asked

Animation comes from something that happened: a message between agents, a
status change, an event from an outside system, a question answered. Under
`prefers-reduced-motion`, orbits, trails and drift stop; state changes still
show as a ring.

## Sound Is Asked For

Off by default, never autoplayed, with a master switch, a volume and a
switch per category. Sounds are synthesised, so no audio file needs a
licence.

## Night Is the Same World After Dark

A world may have a night mode (`night` in its definition): its own palette
and lit details, such as lighthouses lit or lanterns in a garden. Lighting
is Automatic by default and follows the device; the reader can fix Day or
Night in the world picker.

The night palette is held to every rule above: the same status hue
families, 4.5:1 contrast for text on the ground and on a panel, and the
same pulsing ring for anything that needs the reader. Lights that come on
at night are decoration and never take a status hue. A world whose day is
already dark, as Astronomer's is, needs no night.

`packages/worlds/tests/palettes.test.ts` checks every palette, day and
night.

## A World Is Four Parts

| Part       | Lives in                                    |
| ---------- | ------------------------------------------- |
| Vocabulary | `packages/worlds/src/<world>/vocabulary.ts` |
| Palette    | `packages/worlds/src/<world>/palette.ts`    |
| Renderer   | `packages/worlds/src/<world>/canvas.ts`     |
| Voices     | `packages/worlds/src/<world>/voices.ts`     |

`packages/worlds/tests/worlds.test.ts` fails if a world leaves a record type
or a status unnamed.
