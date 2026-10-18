# @atlas/ui

The Atlas React components and their stories. `AtlasShell` is the whole
view: compact for a sidebar or a phone, full page on Expand.

```tsx
import "@atlas/ui/fonts";
import { AtlasShell } from "@atlas/ui";

<AtlasShell dataset={dataset} remember />;
```

Colours and faces come from the world definition through CSS custom
properties (`theme.ts`); `atlas.css` holds layout and shape only.

Stories sit beside their components and run in
[apps/storybook](../../apps/storybook).
