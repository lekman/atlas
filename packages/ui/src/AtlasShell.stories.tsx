import { sampleDataset, sampleScript } from "@atlas/fixtures";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, userEvent, within } from "storybook/test";

import { AtlasShell } from "./AtlasShell";

/**
 * The whole view, on the invented dataset with its scripted day replaying.
 * Compact is the sidebar pane; Expand fills the screen.
 */
const meta = {
  title: "Pages/Atlas",
  component: AtlasShell,
  parameters: { layout: "fullscreen" },
  args: { dataset: sampleDataset, script: sampleScript, interval: 3.4 },
} satisfies Meta<typeof AtlasShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** As it sits in the Claude desktop sidebar: a narrow column beside your sessions. */
function Sidebar({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100vh", background: "#101114" }}>
      <div style={{ width: 420, flex: "none", height: "100%" }}>{children}</div>
      <div
        style={{
          flex: 1,
          borderLeft: "1px solid #24262c",
          padding: 24,
          color: "#9a9ca3",
          font: "14px system-ui",
        }}
      >
        <p style={{ margin: 0 }}>Your Claude sessions sit here.</p>
      </div>
    </div>
  );
}

export const AstronomerInTheSidebar: Story = {
  name: "Astronomer, in the Sidebar",
  args: { initialWorld: "astronomer", initialMode: "compact" },
  render: (args) => (
    <Sidebar>
      <AtlasShell {...args} />
    </Sidebar>
  ),
};

export const MarinerInTheSidebar: Story = {
  name: "Mariner, in the Sidebar",
  args: { initialWorld: "mariner", initialMode: "compact" },
  render: AstronomerInTheSidebar.render,
};

export const AstronomerFullPage: Story = {
  name: "Astronomer, Full Page",
  args: { initialWorld: "astronomer", initialMode: "full" },
};

export const MarinerFullPage: Story = {
  name: "Mariner, Full Page",
  args: { initialWorld: "mariner", initialMode: "full" },
};

export const InspectingAQuestion: Story = {
  name: "Inspecting a Question",
  args: {
    initialWorld: "astronomer",
    initialMode: "full",
    initialSelection: "alarms-live",
  },
};

export const OnAPhone: Story = {
  name: "On a Phone",
  args: { initialWorld: "astronomer", initialMode: "compact" },
  globals: { viewport: { value: "iphone15", isRotated: false } },
};

/** Expand opens the full view; Collapse and Escape bring the sidebar back. */
export const ExpandAndCollapse: Story = {
  name: "Expand and Collapse",
  args: { initialWorld: "astronomer", initialMode: "compact", script: [] },
  render: AstronomerInTheSidebar.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /expand/i }));
    await expect(
      canvas.getByRole("button", { name: /collapse/i }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(
      canvas.getByRole("button", { name: /expand/i }),
    ).toBeInTheDocument();
  },
};

/** Choosing a needs-you entry opens the full view on that record. */
export const OpenFromNeedsYou: Story = {
  name: "Open from Needs You",
  args: { initialWorld: "mariner", initialMode: "compact", script: [] },
  render: AstronomerInTheSidebar.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /severity alarms live at go-live/i }),
    );
    const inspector = await canvas.findByRole("complementary", {
      name: /severity alarms live at go-live/i,
    });
    await expect(within(inspector).getByText(/fog bank/i)).toBeInTheDocument();
    await expect(
      within(inspector).getByText(/open question/i),
    ).toBeInTheDocument();
  },
};

/** Answering a question takes it off the needs-you list. */
export const AnswerAQuestion: Story = {
  name: "Answer a Question",
  args: {
    initialWorld: "astronomer",
    initialMode: "full",
    initialSelection: "pilot-build",
    script: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Answer" }));
    await userEvent.click(canvas.getByRole("button", { name: /collapse/i }));
    await expect(
      canvas.queryByRole("button", { name: /^which build runs in the pilot/i }),
    ).not.toBeInTheDocument();
  },
};
