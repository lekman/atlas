/**
 * The console at a fixed screen size, with invented data, for stories. It
 * holds the state a real page would: the section, the selected item, the
 * fleet and whether settings is open. Lists other than Missions are empty
 * until their step is built.
 */
import { useState } from "react";

import { exampleClients } from "../../sidebar/stories/examples";
import {
  STORY_TODAY,
  STORY_TOMORROW,
  worklistItems,
} from "../../sidebar/stories/worklist";
import type { WorkItem } from "../../sidebar/worklist/model";
import { ConsoleFrame } from "../ConsoleFrame";
import type { RelayState } from "../layout";
import { MissionsList, taskKey } from "../MissionsList";
import { movesFor, type MissionsView, type Range } from "../missions";
import { MoveSheet } from "../MoveSheet";
import { SectionHeading } from "../SectionHeading";
import { sectionNames, sectionPurposes, type Section } from "../sections";
import { TaskSummary } from "../TaskSummary";
import type { Fleet } from "../TopBar";

/** Two invented fleets: the reader's work account and a personal one. */
export const storyFleets: Fleet[] = [
  {
    id: "work",
    label: "Work",
    shortLabel: "WRK",
    mark: "diamond",
    tone: "amber",
  },
  {
    id: "personal",
    label: "Personal",
    shortLabel: "PER",
    mark: "circle",
    tone: "blue",
  },
];

const systemName = (key: string) =>
  exampleClients.find((client) => client.key === key)?.name ?? key;

export interface ConsoleStoryFrameProps {
  /** The screen size in CSS pixels. */
  width: number;
  height: number;
  /** The section the story opens on. */
  section?: Section;
  /** The range and view Missions opens on. */
  range?: Range;
  view?: MissionsView;
  /** A task selected when the story opens, by its ref. */
  selectedKey?: string;
  relay?: RelayState;
}

/**
 * The console at a fixed screen size, with the sidebar's invented worklist.
 * It holds what a real page would: the section, range, view, selected task,
 * fleet, the task being moved and whether settings is open. Moves and Done
 * change the story's own copy of the list.
 */
export function ConsoleStoryFrame({
  width,
  height,
  section: initialSection = "missions",
  range: initialRange = "today",
  view: initialView = "list",
  selectedKey: initialSelected,
  relay = { kind: "live" },
}: ConsoleStoryFrameProps) {
  const [section, setSection] = useState<Section>(initialSection);
  const [items, setItems] = useState<WorkItem[]>(worklistItems);
  const [range, setRange] = useState<Range>(initialRange);
  const [view, setView] = useState<MissionsView>(initialView);
  const [selected, setSelected] = useState<string | null>(
    initialSelected ?? null,
  );
  const [moving, setMoving] = useState<WorkItem | null>(null);
  const [fleetId, setFleetId] = useState("work");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const task = items.find((candidate) => taskKey(candidate) === selected);

  const change = (target: WorkItem, patch: Partial<WorkItem>) =>
    setItems((current) =>
      current.map((candidate) =>
        taskKey(candidate) === taskKey(target)
          ? { ...candidate, ...patch }
          : candidate,
      ),
    );
  const bandPatch: Record<Range, Partial<WorkItem>> = {
    today: { band: "today", day: STORY_TODAY },
    tomorrow: { band: "tomorrow", day: STORY_TOMORROW },
    backlog: { band: "unscheduled", day: undefined },
  };

  const list =
    section === "missions" ? (
      <MissionsList
        items={items}
        today={STORY_TODAY}
        tomorrow={STORY_TOMORROW}
        range={range}
        view={view}
        scope={null}
        selectedKey={selected}
        systemName={systemName}
        canMove={(candidate) => String(candidate.ref ?? "").startsWith("db:")}
        onRangeChange={(next) => {
          setRange(next);
          setSelected(null);
        }}
        onViewChange={setView}
        onScope={() => {}}
        onTriage={() => {}}
        onSelect={(candidate) => setSelected(taskKey(candidate))}
        onMove={setMoving}
      />
    ) : (
      <>
        <SectionHeading
          title={sectionNames[section]}
          scope={null}
          onScope={() => {}}
        />
        <p className="console-empty">
          {sectionPurposes[section]}. Built in a later step.
        </p>
      </>
    );

  return (
    <div
      style={{
        width,
        height,
        transform: "translateZ(0)",
        outline: "1px dashed #5b6b8c",
      }}
    >
      <ConsoleFrame
        initialWidth={width}
        fleets={storyFleets}
        fleetId={fleetId}
        score={21}
        relay={relay}
        section={section}
        counts={{ beam: 3, radar: 5 }}
        settingsOpen={settingsOpen}
        settings={
          <>
            <SectionHeading title="Settings" scope={null} onScope={() => {}} />
            <p className="console-empty">
              The existing settings screen opens here.
            </p>
          </>
        }
        list={list}
        detail={
          task && section === "missions" ? (
            <TaskSummary
              task={task}
              systemName={systemName(task.customer)}
              onDone={(target) => change(target, { done: true })}
              onMove={setMoving}
            />
          ) : null
        }
        onFleetChange={setFleetId}
        onSelectSection={(next) => {
          setSection(next);
          setSelected(null);
          setSettingsOpen(false);
        }}
        onBack={() => setSelected(null)}
        onSettings={() => setSettingsOpen((open) => !open)}
        overlay={
          moving ? (
            <MoveSheet
              task={moving}
              to={movesFor(range)}
              queued={relay.kind !== "live"}
              onMove={(target, to) => {
                change(target, bandPatch[to]);
                setMoving(null);
              }}
              onCancel={() => setMoving(null)}
            />
          ) : null
        }
      />
    </div>
  );
}
