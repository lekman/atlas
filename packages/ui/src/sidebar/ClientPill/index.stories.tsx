import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { ClientPill } from ".";
import { NextUp } from "../NextUp";
import { exampleClients } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Frame/Client Pill",
  component: ClientPill,
  tags: ["autodocs"],
  args: { clients: exampleClients, focus: "all", onChoose: fn() },
  render: function Render(args, { globals }) {
    const [focus, setFocus] = useState(args.focus);
    return (
      <SidebarStoryFrame globals={globals}>
        <NextUp
          state="next"
          title="Halcyon Labs weekly with the data team"
          countdown="in 20 min"
          when="10:00–10:45 · Halcyon Labs"
          corner={
            <ClientPill
              {...args}
              focus={focus}
              onChoose={(key) => {
                setFocus(key);
                args.onChoose(key);
              }}
            />
          }
        />
      </SidebarStoryFrame>
    );
  },
} satisfies Meta<typeof ClientPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every client shown. Opening the menu and choosing one filters the
 * sidebar to that client.
 */
export const AllClients: Story = {
  name: "All Clients",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /showing all clients/i }),
    );
    const menu = canvas.getByRole("menu", { name: "Choose a client" });
    await expect(
      within(menu).getByRole("menuitemradio", { name: "All clients" }),
    ).toHaveFocus();
    await userEvent.click(
      within(menu).getByRole("menuitemradio", { name: "Kestrel Freight" }),
    );
    await expect(args.onChoose).toHaveBeenCalledWith("kestrel");
    await expect(
      canvas.getByRole("button", { name: /showing kestrel freight only/i }),
    ).toHaveFocus();
  },
};

/** One client chosen: the pill takes its name and colour. */
export const OneClient: Story = {
  name: "One Client",
  args: { focus: "halcyon" },
};

/** Arrow keys move through the menu; Escape closes it and returns to the pill. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const pill = canvas.getByRole("button", { name: /showing all clients/i });
    pill.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{ArrowDown}");
    await expect(
      canvas.getByRole("menuitemradio", { name: "Halcyon Labs" }),
    ).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(
      canvas.getByRole("menuitemradio", { name: "Ashgrove Consulting" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("menu")).not.toBeInTheDocument();
    await expect(pill).toHaveFocus();
    await expect(args.onChoose).not.toHaveBeenCalled();
  },
};
