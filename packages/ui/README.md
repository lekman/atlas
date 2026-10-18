# @atlas/ui

The Atlas React components and their stories. `AtlasShell` is the whole
view: compact for a sidebar or a phone, full page on Expand.

```tsx
import "@atlas/ui/fonts";
import { AtlasShell } from "@atlas/ui";

<AtlasShell dataset={dataset} remember />;
```

Colours and faces come from the world definition through CSS custom
properties (`src/theme`); `atlas.css` holds layout and shape only. The theme
is the only place that knows a world's look, so a component never names a
colour.

## Layout

```text
packages/ui/src/
  components/  One directory per component: index.tsx and index.stories.tsx
  pages/       Composed examples on real screen sizes, with play tests
  worlds/      One page of stories per world
  stories/     Helpers the stories share, never exported
  theme/       A world's palette and faces as CSS custom properties
  index.ts     The public surface for the apps
```

## Current Components

| Name           | Purpose                                                       |
| -------------- | ------------------------------------------------------------- |
| `AtlasShell`   | The whole view: compact in a sidebar, full page on Expand     |
| `WorldCanvas`  | The live map: draws a world, pans, zooms, flies to a system   |
| `NeedsYouList` | What needs the reader, first                                  |
| `Inspector`    | One record in full, with the real term and plain-word buttons |
| `LogPanel`     | The running log in the world's voice                          |
| `HudReadout`   | The counts in the full map's corner                           |
| `WorldPicker`  | Choose a world; planned ones are listed but greyed out        |
| `KeyPanel`     | The real term beside every themed one                         |
| `SoundPanel`   | The master switch, volume and a switch per kind of sound      |

## How a Component Is Written

The rules are in [React Components and Stories](../../.claude/rules/components.md).
In short: a named function, an exported `<Name>Props` interface with every
prop documented, callbacks that report rather than act, and a story file
beside it in which every story says in a comment what it shows.

Stories run in [apps/storybook](../../apps/storybook).
