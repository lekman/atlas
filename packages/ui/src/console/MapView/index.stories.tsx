import { sampleDataset } from "@atlas/fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { ConsoleComponentFrame } from "../stories/ConsoleComponentFrame";
import { MapView } from ".";

/**
 * The Map is not in the rail until it has a clear use; this story keeps the
 * component drawn and checked meanwhile.
 */
const meta = {
  title: "Components/Console/Map View",
  tags: ["autodocs"],
  component: MapView,
  args: {
    dataset: sampleDataset,
    systemOf: (clientId: string) => clientId,
    scope: null,
    systemName: (system: string) => system,
    onScope: fn(),
    onOpenAgent: fn(),
    onOpenTask: fn(),
  },
  render: (args) => (
    <ConsoleComponentFrame>
      <div style={{ position: "relative", height: 560 }}>
        <MapView {...args} />
      </div>
    </ConsoleComponentFrame>
  ),
} satisfies Meta<typeof MapView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await expect(
      page.getByRole("img", { name: /Star map of \d+ systems/ }),
    ).toBeInTheDocument();
    await expect(page.getByRole("status")).toHaveTextContent(/systems/);
  },
};

export const Waiting: Story = {
  args: { dataset: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Reading the map…"),
    ).toBeInTheDocument();
  },
};
