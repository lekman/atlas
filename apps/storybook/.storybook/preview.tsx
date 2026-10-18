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
    // Real devices rather than "small mobile" and "large mobile": the ones
    // Atlas is opened on.
    viewport: {
      options: {
        // The iPhone Duo's sizes are estimates. Apple had not published
        // point sizes when these were set; they are the rumoured panel
        // resolutions (outer 1422 x 2088, inner 2713 x 1920 pixels) at the
        // usual iPhone scale of 3. Replace them with Apple's figures.
        iphoneDuoFolded: {
          name: "iPhone Duo, folded",
          styles: { width: "474px", height: "696px" },
          type: "mobile",
        },
        iphoneDuoUnfolded: {
          name: "iPhone Duo, unfolded",
          styles: { width: "904px", height: "640px" },
          type: "tablet",
        },
        iphone15: {
          name: "iPhone 15",
          styles: { width: "393px", height: "852px" },
          type: "mobile",
        },
        // The Claude desktop sidebar on a MacBook Air: a pane beside the
        // sessions, the full height of the window.
        laptopSidebar: {
          name: "Laptop, Claude sidebar",
          styles: { width: "420px", height: "956px" },
          type: "mobile",
        },
        laptopFullPage: {
          name: "Laptop, full page",
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
