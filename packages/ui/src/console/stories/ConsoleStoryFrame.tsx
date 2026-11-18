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
import {
  movesFor,
  scopeChoices,
  type MissionsView,
  type Range,
} from "../missions";
import { ScopeSheet } from "../ScopeSheet";
import { SectionHeading } from "../SectionHeading";
import { ShieldDetail } from "../ShieldDetail";
import { shieldRows, ShieldsList } from "../ShieldsList";
import { shieldAlerts, type ShieldRow } from "../shields";
import { storyHosts, storyIntegrations } from "./shields";
import { STORY_NOW } from "../../sidebar/stories/examples";
import { sectionNames, sectionPurposes, type Section } from "../sections";
import { TaskDetail } from "../TaskDetail";
import type { MenuItem } from "../ConsoleMenu";
import type { MissionsFilter } from "../MissionsList";
import { detailsPage } from "../../sidebar/stories/details";
import { pullsDoc } from "../../sidebar/stories/pulls";
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
  const [scope, setScope] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [shield, setShield] = useState<ShieldRow | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MissionsFilter>({
    done: false,
    waiting: false,
  });
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);
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
  const actionsFor = (target: WorkItem): MenuItem[] =>
    target.done
      ? []
      : [
          {
            label: "Copy reference",
            onSelect: () => setNote(`Copied: ${target.key ?? target.title}`),
          },
          {
            label: "Done",
            divider: true,
            onSelect: () => change(target, { done: true }),
          },
          ...movesFor(range).map((to) => ({
            label: `Move to ${to[0]!.toUpperCase()}${to.slice(1)}`,
            onSelect: () => change(target, bandPatch[to]),
          })),
          {
            label: "Status",
            divider: true,
            onSelect: () => setNote(`Asked the owner about “${target.title}”`),
          },
          {
            label: "Execute",
            onSelect: () => setNote(`Dispatched “${target.title}”`),
          },
        ];
  const bandPatch: Record<Range, Partial<WorkItem>> = {
    today: { band: "today", day: STORY_TODAY },
    tomorrow: { band: "tomorrow", day: STORY_TOMORROW },
    backlog: { band: "unscheduled", day: undefined },
  };

  const shieldData = {
    hosts: storyHosts,
    hostsLive: true,
    hostsStoredAt: null,
    relay,
    integrations: storyIntegrations,
    now: STORY_NOW,
  };
  const list =
    section === "shields" ? (
      <ShieldsList
        {...shieldData}
        selectedId={shield?.id ?? null}
        onSelect={setShield}
      />
    ) : section === "missions" ? (
      <MissionsList
        items={items}
        today={STORY_TODAY}
        tomorrow={STORY_TOMORROW}
        range={range}
        view={view}
        scope={scope}
        selectedKey={selected}
        systemName={systemName}
        query={query}
        filter={filter}
        folded={folded}
        actionsFor={actionsFor}
        actionsFooterFor={() =>
          relay.kind === "live"
            ? undefined
            : "The relay is not live, so moves wait for the Mac mini."
        }
        onQuery={setQuery}
        onFilter={setFilter}
        onFold={setFolded}
        onRangeChange={(next) => {
          setRange(next);
          setSelected(null);
        }}
        onViewChange={setView}
        onScope={() => setPicking(true)}
        onTriage={() => {}}
        onSelect={(candidate) => setSelected(taskKey(candidate))}
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
        counts={{
          beam: 3,
          radar: 5,
          shields: shieldAlerts(shieldRows(shieldData)),
        }}
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
          section === "shields" && shield ? (
            <ShieldDetail
              row={shield}
              host={storyHosts.find((h) => `host:${h.host}` === shield.id)}
              hostsLive
              relay={relay}
              liveAt={
                relay.kind === "live" ? STORY_NOW.getTime() - 60000 : null
              }
              syncedAt={new Date(STORY_NOW.getTime() - 60000).toISOString()}
              integration={storyIntegrations.find(
                (i) => `integration:${i.id}` === shield.id,
              )}
              now={STORY_NOW}
            />
          ) : task && section === "missions" ? (
            <TaskDetail
              task={task}
              systemName={systemName(task.customer)}
              details={
                task.ref === "db:1"
                  ? { state: "ready", page: detailsPage }
                  : task.details
                    ? { state: "missing" }
                    : { state: "none" }
              }
              pulls={task.ref === "db:1" ? pullsDoc : null}
              request={note}
              moves={movesFor(range)}
              now={STORY_NOW}
              onDone={(target) => change(target, { done: true })}
              onMove={(target, to) => change(target, bandPatch[to])}
              onStatus={(target) =>
                setNote(`Asked the owner about “${target.title}”`)
              }
              onExecute={(target) => setNote(`Dispatched “${target.title}”`)}
              onPlan={(target) =>
                setNote(`Asked Commander to plan “${target.title}”`)
              }
              onCopyReference={(target) =>
                setNote(`Copied: ${target.key ?? target.title}`)
              }
            />
          ) : null
        }
        onFleetChange={setFleetId}
        onSelectSection={(next) => {
          setSection(next);
          setSelected(null);
          setShield(null);
          setSettingsOpen(false);
        }}
        onBack={() => {
          setSelected(null);
          setShield(null);
        }}
        onSettings={() => setSettingsOpen((open) => !open)}
        overlay={
          picking ? (
            <ScopeSheet
              {...scopeChoices(
                items,
                exampleClients.map((c) => ({ key: c.key, name: c.name })),
                range,
                STORY_TODAY,
                STORY_TOMORROW,
              )}
              scope={scope}
              onPick={(next) => {
                setScope(next);
                setSelected(null);
                setPicking(false);
              }}
              onCancel={() => setPicking(false)}
            />
          ) : null
        }
      />
    </div>
  );
}
