import type { Meta, StoryObj } from "@storybook/react-vite";

import { Icon, Logo } from "../Icon";
import { ICONS, LOGOS, type IconName, type LogoName } from "../icons";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

function Icons() {
  return (
    <section className="panel">
      <div className="ph">
        <h2>Icons and tracker logos</h2>
      </div>
      <div className="swatches" style={{ padding: 16 }}>
        {(Object.keys(ICONS) as IconName[]).map((name) => (
          <div key={name} className="swatch">
            <div
              className="meta"
              style={{ gridTemplateColumns: "20px 1fr", alignItems: "center" }}
            >
              <Icon name={name} />
              <code>{name}</code>
            </div>
          </div>
        ))}
        {(Object.keys(LOGOS) as LogoName[]).map((name) => (
          <div key={name} className="swatch">
            <div
              className="meta"
              style={{ gridTemplateColumns: "30px 1fr", alignItems: "center" }}
            >
              <Logo name={name} />
              <code>{name}</code>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const meta = {
  title: "Sidebar/Foundations/Icons",
  component: Icons,
  render: (_args, { globals }) => (
    <SidebarStoryFrame globals={globals} width={760}>
      <Icons />
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof Icons>;

export default meta;

/**
 * Line icons, 24 by 24, stroked in the text colour, and the three tracker
 * logos. All are decorative: a control's label says what it does.
 */
export const All: StoryObj<typeof meta> = {};
