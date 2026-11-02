import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { DecisionsView } from ".";
import type { DecisionRule } from "../decisions/model";
import { guards, repeatedAsks, rules } from "../stories/decisions";
import { STORY_NOW } from "../stories/examples";
import { SidebarStoryFrame } from "../stories/SidebarStoryFrame";

const meta = {
  title: "Sidebar/Teach Commander",
  component: DecisionsView,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    asks: repeatedAsks,
    rules,
    guards,
    onAdopt: fn(),
    onKeepAsking: fn(),
    onRuleMode: fn(),
    now: STORY_NOW,
    onClose: fn(),
  },
  render: function Render(args, { globals }) {
    const [asks, setAsks] = useState(args.asks);
    const [kept, setKept] = useState<DecisionRule[]>([...args.rules]);
    return (
      <SidebarStoryFrame globals={globals}>
        <div style={{ position: "relative", minHeight: 720 }}>
          <DecisionsView
            {...args}
            asks={asks}
            rules={kept}
            onAdopt={(r) => {
              args.onAdopt(r);
              const ask = asks.find((a) => a.pattern === r.pattern);
              setKept([
                ...kept,
                {
                  id: `rule-${r.pattern}`,
                  pattern: r.pattern,
                  when: ask?.ask ?? r.pattern,
                  then: r.then,
                  mode: r.mode,
                  used: 0,
                },
              ]);
            }}
            onKeepAsking={(p) => {
              args.onKeepAsking(p);
              setAsks(asks.filter((a) => a.pattern !== p));
            }}
            onRuleMode={(id, mode) => {
              args.onRuleMode(id, mode);
              setKept(kept.map((r) => (r.id === id ? { ...r, mode } : r)));
            }}
          />
        </div>
      </SidebarStoryFrame>
    );
  },
} satisfies Meta<typeof DecisionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Five repeated asks, one of each verdict: a clear rule to suggest, a near
 * one, mixed answers, a guarded production release, and one asked once.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Same answer 5 of 5 times")).toBeVisible();
    await expect(canvas.getByText("Always asks you: Production")).toBeVisible();
    await expect(
      canvas.getByText("Asked 1 time; a rule needs 3"),
    ).toBeVisible();
  },
};

/** The dark theme, which the accessibility check also runs on. */
export const Dark: Story = {
  globals: { lighting: "night" },
};

/** Letting Commander decide moves the ask into its rules, set to tell you. */
export const LetCommanderDecide: Story = {
  name: "Let Commander Decide",
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const [first] = canvas.getAllByRole("button", {
      name: "Let Commander decide",
    });
    await userEvent.click(first!);
    await expect(args.onAdopt).toHaveBeenCalledWith({
      pattern: "dependabot-patch-green",
      then: "Merge",
      mode: "decide-and-tell",
    });
    await expect(
      canvas.getByRole("combobox", {
        name: /How Commander acts: A Dependabot patch bump/,
      }),
    ).toHaveValue("decide-and-tell");
  },
};

/** A rule set back to asking, from its menu. */
export const SetBackToAsking: Story = {
  name: "Set Back to Asking",
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: /An approved PR blocks another/ }),
      "ask",
    );
    await expect(args.onRuleMode).toHaveBeenCalledWith(
      "rule-merge-blocker",
      "ask",
    );
  },
};

/** Nothing learned yet. */
export const Empty: Story = {
  args: { asks: [], rules: [] },
};
