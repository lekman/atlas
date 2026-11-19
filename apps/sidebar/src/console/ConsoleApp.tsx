import type { Runtime } from "@atlas/runtime";
import {
  ConsoleFrame,
  MissionsList,
  movesFor,
  scopeChoices,
  ScopeSheet,
  SectionHeading,
  sectionNames,
  sectionPurposes,
  networkFor,
  ShieldDetail,
  shieldAlerts,
  shieldRows,
  ShieldsList,
  taskKey,
  TaskDetail,
  type IntegrationInput,
  type MenuItem,
  type MissionsFilter,
  type MissionsView,
  type Range,
  type Section,
  type ShieldRow,
} from "@atlas/ui/console";
import { jiraStatuses, referenceText, type WorkItem } from "@atlas/ui/sidebar";
import { useMemo, useState } from "react";

import type { SidebarConfig } from "../config";
import { dayKey } from "../day";
import { PENDING_NOTE } from "../moves";
import { useCommander } from "../useCommander";
import { readDetailsIndex, useDetails } from "../useDetails";
import { useHosts } from "../useHosts";
import { useNow } from "../useNow";
import { usePullRequests } from "../usePullRequests";
import { useStored } from "../useStored";
import { useSync } from "../useSync";
import { copyText, useTaskActions } from "../useTaskActions";
import { useWorklist } from "../useWorklist";
import { relayStateOf } from "./relay";
import { useHostNetwork } from "./useHostNetwork";

export interface ConsoleAppProps {
  runtime: Runtime;
  config: SidebarConfig;
  /** A fixed time, for tests. */
  now?: Date;
}

/** A stored sync document's time, from its `syncedAt`. */
const syncedAtOf = (value: unknown): string | null => {
  const at = (value as { syncedAt?: unknown } | null)?.syncedAt;
  return typeof at === "string" ? at : null;
};

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

const rangeWord = (range: Range) =>
  `${range[0]!.toUpperCase()}${range.slice(1)}`;

/**
 * The full-page console on real data: the worklist the sidebar reads, its
 * task actions, the Commander inbox, the details pages and pull requests,
 * and host statistics. Missions and Shields are built; the other sections
 * say what they will hold.
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
  const hosts = useHosts(runtime);
  const network = useHostNetwork(runtime);
  const jiraSynced = useStored(runtime, "board/jira", syncedAtOf);
  const eventsSynced = useStored(runtime, "board/events", syncedAtOf);
  const jira = useStored(runtime, "board/jira", jiraStatuses);
  useSync(runtime, {
    jira: jiraSynced ?? undefined,
    events: eventsSynced ?? undefined,
  });
  const detailsIndex = useStored(runtime, "board/details", readDetailsIndex);

  const [section, setSection] = useState<Section>("missions");
  const [range, setRange] = useState<Range>("today");
  const [view, setView] = useState<MissionsView>("list");
  const [scope, setScope] = useState<string | null>(readScope);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MissionsFilter>({
    done: false,
    waiting: false,
  });
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shield, setShield] = useState<ShieldRow | null>(null);

  const names = useMemo(
    () => new Map(config.clients.map((c) => [c.key, c.name])),
    [config],
  );
  const systemName = (key: string) => names.get(key) ?? key;
  const task = items.find((t) => taskKey(t) === selected) ?? null;
  const details = useDetails(runtime, task, detailsIndex?.items ?? {});
  const pulls = usePullRequests(runtime, task);
  const relay = relayStateOf(worklist.liveAt, Object.values(commander.records));

  const copyReference = async (t: WorkItem) => {
    const text = referenceText(t.title, t.key);
    // A copy that works says nothing; only a failed one needs the reader.
    setNote(
      (await copyText(text))
        ? null
        : "Could not copy to the clipboard in this view.",
    );
  };
  const fromDatabase = (t: WorkItem) => String(t.ref ?? "").startsWith("db:");
  const actionsFor = (t: WorkItem): MenuItem[] => {
    if (t.done || !t.ref) return [];
    const open = Boolean(commander.open(t.ref));
    return [
      { label: "Copy reference", onSelect: () => void copyReference(t) },
      {
        label: "Done",
        divider: true,
        onSelect: () => void actions.act(t, "task_done"),
      },
      ...(fromDatabase(t)
        ? movesFor(range).map((to) => ({
            label: `Move to ${rangeWord(to)}`,
            onSelect: () => void actions.act(t, "task_move", { to }),
          }))
        : []),
      {
        label: "Status",
        divider: true,
        disabled: open,
        hint: open ? PENDING_NOTE : undefined,
        onSelect: () => void commander.send(t, "status"),
      },
      {
        label: "Execute",
        disabled: open,
        hint: open ? PENDING_NOTE : undefined,
        onSelect: () => void commander.send(t, "execute"),
      },
    ];
  };
  const actionsFooterFor = (t: WorkItem) =>
    commander.open(t.ref)
      ? `${PENDING_NOTE}.`
      : relay.kind === "live"
        ? undefined
        : "The relay is not live, so changes wait for the Mac mini.";

  const database = worklist.doc?.database;
  const integrations: IntegrationInput[] = [
    {
      id: "tasks",
      name: "Task database",
      syncedAt: worklist.doc?.syncedAt ?? null,
      error:
        database && database.ok === false
          ? (database.error ?? "The task database did not answer")
          : null,
    },
    { id: "jira", name: "Jira", syncedAt: jiraSynced ?? null },
    { id: "calendar", name: "Calendars", syncedAt: eventsSynced ?? null },
    {
      id: "hosts",
      name: "Host statistics",
      syncedAt:
        hosts.data?.hosts
          .map((h) => h.lastSeen ?? "")
          .sort()
          .at(-1) || null,
      error: hosts.error?.tone === "err" ? hosts.error.text : null,
    },
  ];
  const storedAt = hosts.data?.storedAt ? new Date(hosts.data.storedAt) : null;
  const shieldData = {
    hosts: hosts.data?.hosts ?? null,
    hostsLive: hosts.live,
    hostsStoredAt: storedAt,
    relay,
    integrations,
    network: network.data,
    now,
  };

  const latest = task ? commander.latest(task.ref) : null;
  const requestLine = latest
    ? [latest.summary ?? `${latest.action} ${latest.state}`, latest.worker]
        .filter(Boolean)
        .join(" · ")
    : null;

  const list =
    section === "shields" ? (
      <ShieldsList
        {...shieldData}
        selectedId={shield?.id ?? null}
        onSelect={setShield}
      />
    ) : section === "missions" ? (
      <>
        {actions.error ? (
          <p className="console-request" role="alert">
            {actions.error}
          </p>
        ) : null}
        {note ? (
          <p className="console-request" role="status">
            {note}
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
            query={query}
            filter={filter}
            folded={folded}
            selectedKey={selected}
            systemName={systemName}
            actionsFor={actionsFor}
            actionsFooterFor={actionsFooterFor}
            onRangeChange={(next) => {
              setRange(next);
              setSelected(null);
            }}
            onViewChange={setView}
            onScope={() => setPicking(true)}
            onTriage={() => {}}
            onSelect={(t) => {
              setSelected(taskKey(t));
              setNote(null);
            }}
            onQuery={setQuery}
            onFilter={setFilter}
            onFold={setFolded}
          />
        )}
      </>
    ) : (
      <>
        <SectionHeading title={sectionNames[section]} />
        <p className="console-empty">
          {sectionPurposes[section]}. Not built yet in this page; the sidebar
          still has it.
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
      counts={{ shields: shieldAlerts(shieldRows(shieldData)) }}
      settingsOpen={settingsOpen}
      settings={
        <>
          <SectionHeading title="Settings" />
          <p className="console-empty">Settings are in the sidebar for now.</p>
        </>
      }
      list={list}
      detail={
        section === "shields" && shield ? (
          <ShieldDetail
            row={
              shieldRows(shieldData).find((r) => r.id === shield.id) ?? shield
            }
            host={hosts.data?.hosts.find((h) => `host:${h.host}` === shield.id)}
            network={networkFor(network.data, shield.name)}
            hostsLive={hosts.live}
            hostsStoredAt={storedAt}
            relay={relay}
            liveAt={worklist.liveAt}
            syncedAt={worklist.doc?.syncedAt ?? null}
            integration={integrations.find(
              (i) => `integration:${i.id}` === shield.id,
            )}
            now={now}
          />
        ) : task && section === "missions" ? (
          <TaskDetail
            task={task}
            systemName={systemName(task.customer)}
            details={details}
            pulls={pulls.doc}
            pullsCopy={pulls.copy}
            mondayPrefix={
              config.trackers.find((t) => t.monday)?.monday?.keyPrefix
            }
            jiraStatuses={jira}
            request={requestLine}
            commanderBusy={commander.open(task.ref) ? PENDING_NOTE : null}
            moves={fromDatabase(task) ? movesFor(range) : []}
            now={now}
            onDone={(t) => void actions.act(t, "task_done")}
            onState={(t, state) =>
              // Done keeps the done tool, which every host and the phone inbox know.
              void (state === "done"
                ? actions.act(t, "task_done")
                : actions.act(t, "task_state", { state }))
            }
            onAssess={(t, change) => void actions.act(t, "task_assess", change)}
            onMove={(t, to) => void actions.act(t, "task_move", { to })}
            onStatus={(t) => void commander.send(t, "status")}
            onExecute={(t) => void commander.send(t, "execute")}
            onPlan={(t) => void commander.plan(t)}
            onCopyReference={(t) => void copyReference(t)}
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
        ) : null
      }
      onFleetChange={() => {}}
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
    />
  );
}
