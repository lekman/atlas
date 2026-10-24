# @atlas/worlds

How each world looks and sounds, kept free of React so the same code serves
the web app, the Claude Artifact and the still map in a Claude Code plugin.

- `layout.ts`: where everything sits, in world units. Home at the centre,
  clients in two columns, landscape or portrait, and each client's
  workstreams on an orbit round it.
- `labels.ts`: the shortened words the map writes beside work.
- `scene.ts`: the live state: agent motion, effects set off by events.
- `paint.ts`: the drawing order every world shares, and hit targets.
- `astronomer/`, `mariner/`: vocabulary, palette, canvas painter, voices.
- `svg.ts`: a still map as an SVG string.
- `sound.ts`: Web Audio synthesis, off until asked.

See [Worlds](../../docs/worlds.md) for the mapping and how to add a world.
