# React Components and Stories

The same conventions as the other repositories by the same author. They
keep a component findable, its states reviewable in Storybook, and its
stories honest tests.

## One Directory per Component

```text
packages/ui/src/components/<Name>/
  index.tsx          The component, its Props interface, helpers it alone uses
  index.stories.tsx  Its stories, beside it
```

Composed examples on real screen sizes go in `src/pages/`, one page of
stories per world in `src/worlds/`, and helpers that only stories use in
`src/stories/`. `src/index.ts` exports each component with its props type.

## Writing a Component

- A named function component, `export function Name(...)`. No default
  exports, no classes.
- An exported `NameProps` interface. Every prop has a one-line comment that
  says what it is for, not what type it is.
- Callbacks report and change nothing themselves: `onSelect`, `onChange`,
  `onAction`. The parent decides what a pick means, so a component never
  depends on where it is used.
- A comment on the component says what it is for and why it looks as it
  does. Where a choice was made for contrast or accessibility, the comment
  gives the numbers.
- No colour or font in a component. They come from `src/theme` as CSS
  custom properties, set from the world; `atlas.css` holds layout and shape.
- Buttons keep plain words in every world. See
  [Rules Every World Keeps](worlds.md).

## Writing Stories

- `meta` uses `satisfies Meta<typeof Name>`, and stories are typed with
  `StoryObj<typeof meta>`. Component stories carry `tags: ["autodocs"]`.
- Titles are prose in title case under `Pages`, `Worlds` or `Components`.
  See [Names Are Written Out in Full](naming.md).
- Every story has a comment above it saying what it shows and why it is
  worth a story. One state per story; the Controls tab covers the rest.
- A story that shows an interaction proves it with a `play` function, and
  queries by role and accessible name, as a screen reader would.
- Stories use only the invented dataset in `packages/fixtures`. See
  [No Client Content, Ever](client-content.md).
- Every story is a browser test with axe, and an accessibility finding
  fails it. Run `task test:stories` before pushing; the pre-push hook does.
