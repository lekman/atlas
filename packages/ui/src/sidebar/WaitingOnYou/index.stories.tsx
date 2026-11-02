import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { WaitingOnYou } from ".";
import { exampleClients } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";
import { OPERATOR, waitingItems } from "../stories/waiting";

const colourOf = (key: string) =>
  exampleClients.find((c) => c.key === key) ?? {
    name: "Other",
    colour: "var(--client-other)",
  };

const openTask = fn();

const meta = {
  title: "Sidebar/Worklist/Waiting On You",
  component: WaitingOnYou,
  tags: ["autodocs"],
  args: {
    operator: OPERATOR,
    rows: [
      { item: waitingItems[0]!, client: colourOf("kestrel"), onOpen: openTask },
      { item: waitingItems[1]!, client: colourOf("halcyon") },
      { item: waitingItems[2]!, client: colourOf("other") },
    ],
  },
  render: (args, { globals }) => (
    <SidebarStoryFrame globals={globals}>
      <section className="panel">
        <WaitingOnYou {...args} />
      </section>
    </SidebarStoryFrame>
  ),
} satisfies Meta<typeof WaitingOnYou>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One of each: a blocked task (opens its details), a Commander request that
 * asks you, and a question from Commander. The asks drop your name; a
 * Commander summary keeps its context as the tooltip.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", { name: /waiting on you\s*3/i });
    await expect(region).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Approve the cut-over window for Saturday",
      }),
    );
    await expect(openTask).toHaveBeenCalled();
    await expect(
      canvas.getByText("Confirm the release notes before production"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Commander · Halcyon")).toBeInTheDocument();
    await expect(canvas.getByText("Commander asks")).toBeInTheDocument();
  },
};

/** A task whose details are not loaded yet: the ask is plain text. */
export const WithoutDetails: Story = {
  name: "Without Details",
  args: {
    rows: [{ item: waitingItems[0]!, client: colourOf("kestrel") }],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

/** Nothing waits: the box is not there at all. */
export const NothingWaiting: Story = {
  name: "Nothing Waiting",
  args: { rows: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("region")).toBeNull();
  },
};

/**
 * Nothing to list, but a source couldn't be read: a quiet note says which,
 * with the messages as its tooltip, so it doesn't read as nothing waiting.
 */
export const SourceFailed: Story = {
  name: "Source Failed",
  args: {
    rows: [],
    errors: ["questions: connection refused", "commander: timed out after 10s"],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        "Couldn't check everything that waits on you: questions, commander.",
      ),
    ).toBeInTheDocument();
  },
};

/**
 * With Teach Commander: an icon takes the count's place and says the count
 * in its name. An ask a rule would answer says so under it.
 */
export const WithTeach: Story = {
  name: "With Teach",
  args: {
    onTeach: fn(),
    rows: [
      { item: waitingItems[0]!, client: colourOf("kestrel"), onOpen: openTask },
      { item: waitingItems[1]!, client: colourOf("halcyon") },
      {
        item: {
          kind: "commander",
          worker: "Kestrel",
          ask: "Dependabot patch bump is green; Alex to merge it",
          since: "2026-03-12T09:40:00",
        },
        client: colourOf("kestrel"),
        rule: "merge green Dependabot patches, and tell you",
      },
      { item: waitingItems[2]!, client: colourOf("other") },
    ],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Teach Commander, 4 waiting" }),
    );
    await expect(args.onTeach).toHaveBeenCalledOnce();
    await expect(
      canvas.getByText(/Commander's rule: merge green Dependabot/),
    ).toBeVisible();
  },
};

/** Answered over ten minutes ago and still waiting: marked, with when it was answered. */
export const AnsweredNoReply: Story = {
  name: "Answered, No Reply",
  args: {
    rows: [
      {
        item: waitingItems[2]!,
        client: colourOf("other"),
        answeredAt: "2026-03-12T09:56:33",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Answered 09:56, no reply yet/),
    ).toBeVisible();
  },
};
