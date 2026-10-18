import { worldIds, worlds } from "@atlas/worlds";
import type { Preview } from "@storybook/react-vite";

// Served from this Storybook, not from Google: it is published publicly, and
// a font request would send every visitor's IP address to a third party.
import "@atlas/ui/fonts";
import "@atlas/ui/atlas.css";

const preview: Preview = {
  globalTypes: {
    world: {
      description: "The world components are shown in",
      toolbar: {
        title: "World",
        icon: "globe",
        items: worldIds.map((id) => ({ value: id, title: worlds[id].name })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { world: "astronomer" },
  decorators: [
    (Story) => (
      <>
        <style>
          {"html, body, #storybook-root { height: 100%; margin: 0; }"}
        </style>
        <Story />
      </>
    ),
  ],
  parameters: {
    options: {
      storySort: { order: ["Introduction", "Pages", "Worlds", "Components"] },
    },
    // Real devices rather than "small mobile" and "large mobile".
    viewport: {
      options: {
        iphone15: {
          name: "iPhone 15",
          styles: { width: "393px", height: "852px" },
          type: "mobile",
        },
        iphone15ProMax: {
          name: "iPhone 15 Pro Max",
          styles: { width: "430px", height: "932px" },
          type: "mobile",
        },
        ipadMini: {
          name: "iPad mini",
          styles: { width: "744px", height: "1133px" },
          type: "tablet",
        },
        macbookAir: {
          name: "MacBook Air, 1470",
          styles: { width: "1470px", height: "956px" },
          type: "desktop",
        },
        studioDisplay: {
          name: "Studio Display, 2560",
          styles: { width: "2560px", height: "1440px" },
          type: "desktop",
        },
      },
    },
    backgrounds: { disable: true },
    // An accessibility finding fails the test rather than being noted. Held
    // to the WCAG 2.2 AA rules; axe's best-practice rules assume a whole page
    // and misfire on a component shown alone.
    a11y: {
      test: "error",
      options: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      },
    },
  },
};

export default preview;
