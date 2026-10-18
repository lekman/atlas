# @atlas/core

The Atlas data model, its events, the needs-you list and the boundary rules.
Plain TypeScript and Zod; no React, no drawing.

- `model.ts`: clients (one is home), accounts, agent groups, agents,
  requirements, backlog items, questions, decisions. Every record carries a
  classification and a boundary.
- `events.ts`: the four events that change anything, and `applyEvent`.
- `records.ts`: lookups, broken-reference checks, `needsYou`.
- `boundaries.ts`: what may cross between boundaries, as a card only, and a
  deterministic check for personal data in a card title.
