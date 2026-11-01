import type { Meta, StoryObj } from "@storybook/react-vite";

import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

/** Every sidebar colour token, what it is for, and the rule it follows. */
const TOKENS: Array<{ group: string; items: Array<[string, string]> }> = [
  {
    group: "Surfaces",
    items: [
      ["--bg", "The page behind the panels"],
      ["--panel", "Panels, menus and cards"],
      ["--line", "Borders and dividers"],
      ["--now", "The current hour, and selected rows"],
      ["--hatch", "Sample data, skeletons and hover fills"],
    ],
  },
  {
    group: "Text",
    items: [
      ["--ink", "Body text and titles"],
      ["--muted", "Secondary text, counts and labels"],
      ["--accent", "Links, focus rings and the open tab"],
    ],
  },
  {
    group: "Status",
    items: [
      ["--ok", "Healthy, or on its head"],
      ["--yellow", "A gap, or a warning"],
      ["--bad", "A failure, or critical"],
      ["--warn", "Amber: something needs you"],
    ],
  },
  {
    group: "Clients",
    items: [
      ["--client-1", "Client slot 1"],
      ["--client-2", "Client slot 2"],
      ["--client-3", "Client slot 3"],
      ["--client-4", "Client slot 4"],
      ["--client-5", "Client slot 5"],
      ["--client-other", "A client without a slot"],
    ],
  },
];

function Colours() {
  return (
    <>
      {TOKENS.map(({ group, items }) => (
        <section key={group} className="panel">
          <div className="ph">
            <h2>{group}</h2>
          </div>
          <div className="swatches" style={{ padding: 16 }}>
            {items.map(([token, use]) => (
              <div key={token} className="swatch">
                <div className="chip" style={{ background: `var(${token})` }} />
                <div className="meta">
                  <code>{token}</code>
                  <span
                    style={{
                      color: `var(${token === "--bg" || token === "--panel" || token === "--line" || token === "--now" || token === "--hatch" ? "--muted" : token})`,
                    }}
                  >
                    {use}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

const meta = {
  title: "Sidebar/Foundations/Colours",
  component: Colours,
  render: (_args, { globals }) => (
    <SidebarStoryFrame globals={globals} width={760}>
      <Colours />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof Colours>;

export default meta;

/**
 * The sidebar's palette. Switch Lighting in the toolbar for the dark
 * theme. Each text, status and client colour is written in itself under
 * its swatch, and each meets 4.5:1 on the panel, the page and the "now"
 * highlight in both themes; a unit test holds it there.
 */
export const Palette: StoryObj<typeof meta> = {};

/** The dark palette, so the accessibility check runs on it too. */
export const PaletteDark: StoryObj<typeof meta> = {
  name: "Palette, Dark",
  globals: { lighting: "night" },
};
