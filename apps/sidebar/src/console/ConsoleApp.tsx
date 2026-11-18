import type { Runtime } from "@atlas/runtime";
import {
  ConsoleFrame,
  MissionsList,
  MoveSheet,
  movesFor,
  scopeChoices,
  ScopeSheet,
  SectionHeading,
  sectionNames,
  sectionPurposes,
  taskKey,
  TaskSummary,
  type MissionsView,
  type Range,
  type Section,
} from "@atlas/ui/console";
import type { WorkItem } from "@atlas/ui/sidebar";
import { useMemo, useState } from "react";

import type { SidebarConfig } from "../config";
import { dayKey } from "../day";
import { useCommander } from "../useCommander";
import { useNow } from "../useNow";
import { useTaskActions } from "../useTaskActions";
import { useWorklist } from "../useWorklist";
import { relayStateOf } from "./relay";

export interface ConsoleAppProps {
  runtime: Runtime;
  config: SidebarConfig;
  /** A fixed time, for tests. */
  now?: Date;
}

const SCOPE_KEY = "atlas-console-scope";

/** The system this device last narrowed to. Storage can be blocked. */
function readScope(): string | null {
  try {
    return globalThis.localStorage?.getItem(SCOPE_KEY) || null;
  } catch {
    return null;
  }
}

function keepScope(scope: string | null): void {
  try {
    if (scope) globalThis.localStorage?.setItem(SCOPE_KEY, scope);
    else globalThis.localStorage?.removeItem(SCOPE_KEY);
  } catch {
    // Not kept; the choice holds until the page closes.
  }
}

const TO: Record<Range, string> = {
  today: "today",
  tomorrow: "tomorrow",
  backlog: "backlog",
};

/**
 * The full-page console on real data: the worklist the sidebar reads, its
 * task actions and the Commander inbox. Only Missions is built; the other
 * sections say what they will hold. This page is published as a separate
 * test artifact, beside the sidebar, until it can replace it.
 */
export function ConsoleApp({
  runtime,
  config,
  now: fixedNow,
}: ConsoleAppProps) {
  const now = useNow(fixedNow);
  const today = dayKey(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dayKey(tomorrowDate);

  const worklist = useWorklist(runtime, now);
  const commander = useCommander(runtime, config.inbox);
  const actions = useTaskActions(runtime, commander, worklist.apply);
  const items = worklist.doc?.items ?? [];

  const [section, setSection] = useState<Section>("missions");
  const [range, setRange] = useState<Range>("today");
  const [view, setView] = useState<MissionsView>("list");
  const [scope, setScope] = useState<string | null>(readScope);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [moving, setMoving] = useState<WorkItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const names = useMemo(
    () => new Map(config.clients.map((c) => [c.key, c.name])),
    [config],
  );
  const systemName = (key: string) => names.get(key) ?? key;
  const task = items.find((t) => taskKey(t) === selected) ?? null;
  const relay = relayStateOf(worklist.liveAt, Object.values(commander.records));
  const canMove = (t: WorkItem) =>
    String(t.ref ?? "").startsWith("db:") && commander.open(t.ref) === null;

  const list =
    section === "missions" ? (
      <>
        {actions.error ? (
          <p className="console-sheet-note" role="alert">
            {actions.error}
          </p>
        ) : null}
        {worklist.pending ? (
          <p className="console-empty">Reading the worklist…</p>
        ) : (
          <MissionsList
            items={items}
            today={today}
            tomorrow={tomorrow}
            range={range}
            view={view}
            scope={scope}
            selectedKey={selected}
            systemName={systemName}
            canMove={canMove}
            onRangeChange={(next) => {
              setRange(next);
              setSelected(null);
            }}
            onViewChange={setView}
            onScope={() => setPicking(true)}
            onTriage={() => {}}
            onSelect={(t) => setSelected(taskKey(t))}
            onMove={setMoving}
          />
        )}
      </>
    ) : (
      <>
        <SectionHeading
          title={sectionNames[section]}
          scope={null}
          onScope={() => {}}
        />
        <p className="console-empty">
          {sectionPurposes[section]}. Not built yet in this test page; the
          sidebar still has it.
        </p>
      </>
    );

  return (
    <ConsoleFrame
      fleets={[]}
      fleetId=""
      score={null}
      relay={relay}
      section={section}
      settingsOpen={settingsOpen}
      settings={
        <>
          <SectionHeading title="Settings" scope={null} onScope={() => {}} />
          <p className="console-empty">Settings are in the sidebar for now.</p>
        </>
      }
      list={list}
      detail={
        task && section === "missions" ? (
          <TaskSummary
            task={task}
            systemName={systemName(task.customer)}
            onDone={(t) => void actions.act(t, "task_done")}
            onMove={setMoving}
          />
        ) : null
      }
      overlay={
        picking ? (
          <ScopeSheet
            {...scopeChoices(items, config.clients, range, today, tomorrow)}
            scope={scope}
            onPick={(next) => {
              setScope(next);
              keepScope(next);
              setSelected(null);
              setPicking(false);
            }}
            onCancel={() => setPicking(false)}
          />
        ) : moving ? (
          <MoveSheet
            task={moving}
            to={movesFor(range)}
            queued={relay.kind !== "live"}
            onMove={(t, to) => {
              setMoving(null);
              void actions.act(t, "task_move", { to: TO[to] });
            }}
            onCancel={() => setMoving(null)}
          />
        ) : null
      }
      onFleetChange={() => {}}
      onSelectSection={(next) => {
        setSection(next);
        setSelected(null);
        setSettingsOpen(false);
      }}
      onBack={() => setSelected(null)}
      onSettings={() => setSettingsOpen((open) => !open)}
    />
  );
}
