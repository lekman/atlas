import { sampleDataset } from "@atlas/fixtures";
import { worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { AtlasShell, type AtlasShellProps } from ".";
import { storyLighting, storyWorld } from "../../stories/WorldFrame";

const meta = {
  title: "Components/Atlas Shell",
  component: AtlasShell,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { dataset: sampleDataset, initialMode: "compact" },
  render: (args, { globals }) => (
    <div style={{ height: "100vh" }}>
      <AtlasShell
        {...args}
        key={`${storyWorld(globals)}-${storyLighting(globals)}`}
        initialWorld={storyWorld(globals)}
        initialLighting={storyLighting(globals)}
      />
    </div>
  ),
} satisfies Meta<typeof AtlasShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The shell on its own, with no scripted day, so the Controls tab can try
 * each input. The composed examples on real screen sizes are under Pages.
 */
export const Compact: Story = {};

/** The full view: map, HUD and log; the HUD holds the record you pick. */
export const Full: Story = { args: { initialMode: "full" } };

/** The bar and the worlds the web app offers: Sound, the cog, and two worlds. */
const webApp = {
  initialMode: "full",
  worlds: ["astronomer", "mariner"],
  controls: ["sound", "settings"],
} satisfies Partial<AtlasShellProps>;

/**
 * The cog opened, as the web app has it: a World section above the sound
 * settings, with one radio button for each world the app offers. The bar
 * has no world button, so this is where the world is chosen.
 */
export const SettingsWithAWorldChoice: Story = {
  name: "Settings with a World Choice",
  args: webApp,
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("button", { name: /choose a world/i }),
    ).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Settings" }));
    const settings = await canvas.findByRole("dialog", { name: "Settings" });
    const choice = within(
      within(settings).getByRole("group", { name: "World" }),
    );
    await expect(choice.getAllByRole("radio")).toHaveLength(2);
    const shown = worlds[storyWorld(globals)].name;
    await expect(
      choice.getByRole("radio", { name: new RegExp(`^${shown}`) }),
    ).toBeChecked();
  },
};

/**
 * Mariner on the invented dataset, as the web app shows it, with the
 * settings open: Mariner chosen, and the lighting it offers for its night
 * watch below the worlds.
 */
export const MarinerWithTheSampleData: Story = {
  name: "Mariner with the Sample Data",
  args: webApp,
  globals: { world: "mariner" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("img", { name: /mariner map: 4 islands/i }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Settings" }));
    const settings = await canvas.findByRole("dialog", { name: "Settings" });
    await expect(
      within(settings).getByRole("radio", { name: /^Mariner/ }),
    ).toBeChecked();
    await expect(
      within(settings).getByRole("group", { name: "Lighting" }),
    ).toBeInTheDocument();
  },
};
