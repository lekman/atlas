# Names Are Written Out in Full

Never abbreviate a word in a name. `SideNav` is `SideNavigation`, and the
Storybook entry for it reads **Side Navigation**.

This is the same rule as the house tone, applied to identifiers. A reader
who does not use English as a first language can look up "navigation". They
cannot look up "nav", and neither can a search.

## What This Covers

Component names, props, types, constants, file and directory names, and
every Storybook title.

| Write            | Not                  |
| ---------------- | -------------------- |
| `SideNavigation` | `SideNav`, `Sidenav` |
| `NavigationItem` | `NavItem`            |
| `navigation`     | `nav`                |
| `configuration`  | `config`, `cfg`      |
| `button`         | `btn`                |
| `previous`       | `prev`               |
| `temporary`      | `tmp`, `temp`        |
| `repository`     | `repo`               |

## Acronyms Are Not Abbreviations

An acronym the product itself uses in front of a customer is a word here.
**MCP**, **CI**, **PII**, **SVG** and **HUD** stay as they are, and stay
uppercase in prose and in Storybook titles. In a PascalCase identifier
they follow the usual TypeScript convention, so the type is `HudReadout` and
its Storybook title is **HUD Readout**.

Define one at first use in any document a customer or a new joiner reads.

Established shortenings that are the real name of a thing are also fine:
`id`, `url`, `http`, `api`, `sql`. So is a loop variable such as `i`.

## Storybook Titles Are Prose

A title is what a person reads in the sidebar, so it is spaced words in
title case, never the identifier.

| Title            | Component                       |
| ---------------- | ------------------------------- |
| `Needs You List` | `NeedsYouList`                  |
| `World Canvas`   | `WorldCanvas`                   |
| `HUD Readout`    | `HudReadout`                    |
| `On a Page`      | n/a, a set of composed examples |

The section is plural and a category: `Pages`, `Worlds`, `Components`.

## Related

The tone rules this follows are in
[lekman/ai-toolkit](https://github.com/lekman/ai-toolkit) under
`standards/TONE.md`, and the repository's own voice is the `tone` plugin
described in [CLAUDE.md](../../CLAUDE.md).
