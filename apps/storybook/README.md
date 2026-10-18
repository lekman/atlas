# Atlas Storybook

Presents, tests and publishes the stories in [`@atlas/ui`](../../packages/ui).
The stories live beside their components in that package; this app holds
only the configuration.

```sh
bun run storybook        # http://localhost:6006
bun run build-storybook  # static site into storybook-static/
bun run test             # every story as a browser test
```

Every story runs on the invented dataset in
[`@atlas/fixtures`](../../packages/fixtures). The published site is public,
so nothing here may come from real work.

## Tests

Every story is a test. The Storybook Vitest addon renders each one in
Chromium through Playwright, fails on a thrown error, runs any `play`
function, and checks the result with axe. An accessibility finding fails
the run.

### Why This App Uses Vitest

The [stack standard](../../.claude/rules/stack.md) says `bun test`. Story
tests are the exception: they render in a real browser, which is what makes
an accessibility check meaningful, and `bun test` cannot drive a browser.
Nothing else in the repository uses Vitest.

The test script installs Playwright's headless Chromium first. In CI it adds
the system libraries with `--with-deps`; locally it does not, because that
would need `sudo` inside a git hook.

## Fonts

The world faces come from `@fontsource`, imported in
[`.storybook/preview.tsx`](.storybook/preview.tsx), never from Google Fonts.
A public site that fetched fonts from Google would hand every visitor's IP
address to a third party before the page draws.
