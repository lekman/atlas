import { worldIds, worlds } from "@atlas/worlds";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { WorldPicker } from ".";
import {
  storyLighting,
  storyWorld,
  WorldFrame,
} from "../../stories/WorldFrame";

const meta = {
  title: "Components/World Picker",
  component: WorldPicker,
  tags: ["autodocs"],
  args: {
    current: "astronomer",
    onChange: fn(),
    lighting: "automatic",
    onLightingChange: fn(),
  },
  render: (args, { globals }) => (
    <WorldFrame world={storyWorld(globals)} lighting={storyLighting(globals)}>
      <WorldPicker {...args} current={storyWorld(globals)} />
    </WorldFrame>
  ),
} satisfies Meta<typeof WorldPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every built world, with the one in use marked. Picking one reports it
 * and changes nothing itself: the shell decides what a pick means.
 */
export const EveryWorld: Story = {
  play: async ({ canvasElement, args, globals }) => {
    const canvas = within(canvasElement);
    for (const id of worldIds) {
      await expect(
        canvas.getByRole("button", { name: new RegExp(worlds[id].name, "i") }),
      ).toBeEnabled();
    }
    const other = worldIds.find((id) => id !== storyWorld(globals));
    if (!other) return;
    await userEvent.click(
      canvas.getByRole("button", { name: new RegExp(worlds[other].name, "i") }),
    );
    await expect(args.onChange).toHaveBeenCalledWith(other);
  },
};

/**
 * Lighting follows the device until the reader picks Day or Night. The
 * choice is reported; the shell applies it.
 */
export const ChooseNight: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("radio", { name: "Automatic" }),
    ).toBeChecked();
    await userEvent.click(canvas.getByRole("radio", { name: "Night" }));
    await expect(args.onLightingChange).toHaveBeenCalledWith("night");
  },
};

/**
 * An app that offers one world lists only that one, and no planned
 * worlds.
 */
export const AstronomerOnly: Story = {
  name: "Astronomer Only",
  args: { worlds: ["astronomer"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const offered = canvas
      .getAllByRole("button")
      .filter((button) => button.classList.contains("atlas-world"));
    await expect(offered).toHaveLength(1);
    await expect(offered[0]).toHaveTextContent(worlds.astronomer.name);
  },
};

/**
 * As the top of the settings panel: the offered worlds as radio buttons,
 * then the lighting. Picking a world reports it, as the dialog does.
 */
export const InTheSettingsPanel: Story = {
  name: "In the Settings Panel",
  args: { worlds: ["astronomer", "mariner"], variant: "section" },
  render: (args, { globals }) => (
    <WorldFrame world={storyWorld(globals)} lighting={storyLighting(globals)}>
      <div className="atlas-panel" role="dialog" aria-label="Settings">
        <WorldPicker {...args} current="astronomer" />
      </div>
    </WorldFrame>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const choice = within(canvas.getByRole("group", { name: "World" }));
    await expect(choice.getAllByRole("radio")).toHaveLength(2);
    await expect(
      choice.getByRole("radio", { name: /^Astronomer/ }),
    ).toBeChecked();
    await userEvent.click(choice.getByRole("radio", { name: /^Mariner/ }));
    await expect(args.onChange).toHaveBeenCalledWith("mariner");
    await expect(
      canvas.getByRole("group", { name: "Lighting" }),
    ).toBeInTheDocument();
  },
};
