import { describeError, type Runtime, type RuntimeError } from "@atlas/runtime";
import {
  ConsoleFrame,
  ConsoleSettings,
  LogList,
  readLog,
  type LogView,
  RadarList,
  radarTickets,
  type RadarTicket,
  type RadarView,
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
import {
  agendaDays,
  formatAgo,
  jiraErrorText,
  jiraStatuses,
  readJira,
  referenceText,
  syncLabel,
  type WorkItem,
} from "@atlas/ui/sidebar";
import { useEffect, useMemo, useState } from "react";

import type { SidebarConfig } from "../config";
import { dayKey } from "../day";
import { PENDING_NOTE } from "../moves";
import { useCommander } from "../useCommander";
import { readDetailsIndex, useDetails } from "../useDetails";
import { useHosts } from "../useHosts";
import { useCalendar } from "../useCalendar";
import { useFeed } from "../useFeed";
import { useGitHub } from "../useGitHub";
import { useMonday } from "../useMonday";
import { useNow } from "../useNow";
import { usePreferences } from "../usePreferences";
import { usePullRequests } from "../usePullRequests";
import { useStored } from "../useStored";
import { useSync } from "../useSync";
import { copyText, useTaskActions } from "../useTaskActions";
import { worklistMeetings } from "../worklist";
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

/**
 * Why the log shows nothing, in words, when it has no copy: the host's own
 * error, or, for the errors the feed keeps quiet, what they mean here.
 */
function logNote(
  log: {
    data: unknown;
    error: { text: string } | null;
    failure: { code: string } | null;
  },
  late: boolean,
): string | null {
  if (log.error) return log.error.text;
  if (log.data) return null;
  if (log.failure)
    return log.failure.code === "server_not_connected" ||
      log.failure.code === "not_granted"
      ? "The log comes from the dashboard server on your Mac. This device can't reach it, and no copy is stored yet; open the console on the Mac once."
      : describeError(log.failure as RuntimeError, "The dashboard server");
  return late
    ? "The dashboard server hasn't answered yet. If this stays, its copy on this device may need updating to read the log."
    : null;
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
  const prefs = usePreferences();
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

  // Radar: the trackers' tickets and the week's meetings, as the sidebar reads them.
  const mondayTracker = config.trackers.find((t) => t.monday);
  const githubTracker = config.trackers.find((t) => t.github);
  const jiraTracker = config.trackers.find((t) => t.logo === "jira");
  const monday = useMonday(runtime, mondayTracker?.monday);
  const github = useGitHub(runtime, githubTracker?.github);
  const jiraDoc = useStored(runtime, "board/jira", readJira);
  const eventsDoc = useStored(runtime, "board/events", (d) =>
    typeof d === "object" && d !== null
      ? (d as { syncedAt?: string; items?: unknown })
      : null,
  );
  const workMeetings = useMemo(
    () => worklistMeetings(items, config.calendar?.timeZone ?? "Europe/London"),
    [items, config],
  );
  const calendar = useCalendar(runtime, config, eventsDoc, now, workMeetings);
  const tickets = useMemo(
    () =>
      jiraDoc === undefined && !monday.data && !github.data
        ? null
        : radarTickets({
            jira: jiraTracker
              ? { client: jiraTracker.client, doc: jiraDoc }
              : null,
            monday: mondayTracker
              ? { client: mondayTracker.client, page: monday.data }
              : null,
            github: githubTracker
              ? {
                  client: githubTracker.client,
                  page: github.data,
                  me: github.me,
                }
              : null,
            items,
          }),
    [jiraDoc, monday.data, github.data, github.me, items, config],
  );
  const radarNotes = [
    ...(jiraDoc && !jiraDoc.ok ? [jiraErrorText(jiraDoc.error)] : []),
    ...(monday.error ? [monday.error.text] : []),
    ...(github.error ? [github.error.text] : []),
    ...calendar.errors.map((e) => e.text),
  ];
  const [radarView, setRadarView] = useState<RadarView>("meetings");

  // Log: finished tasks from the dashboard host, stored for the phone.
  const log = useFeed(
    runtime,
    {
      server: "host:dashboard",
      tool: "task_log",
      args: { days: 28 },
      path: "board/log",
      accept: readLog,
      watch: {
        refetchInterval: 10 * 60000,
        cache: { staleTime: 5 * 60000, gcTime: 86400000 },
      },
    },
    "The dashboard host",
  );
  const [logView, setLogView] = useState<LogView>("days");
  // The log never waits silently: after 20 seconds without an answer, it says so.
  const [logLate, setLogLate] = useState(false);
  useEffect(() => {
    if (log.data || log.failure) return;
    const timer = setTimeout(() => setLogLate(true), 20000);
    return () => clearTimeout(timer);
  }, [log.data, log.failure]);
  const [showTracked, setShowTracked] = useState(false);
  const ticketRef = (t: RadarTicket) => `${t.system}:${t.key}`;

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
            mondayPrefix={
              config.trackers.find((t) => t.monday)?.monday?.keyPrefix
            }
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
    ) : section === "log" ? (
      <LogList
        view={logView}
        onViewChange={setLogView}
        items={log.data?.items ?? (log.failure || logLate ? [] : null)}
        note={logNote(log, logLate)}
        copyFrom={
          !log.live && log.data?.fetchedAt
            ? formatAgo(new Date(log.data.fetchedAt), now)
            : null
        }
        systemName={systemName}
        scope={scope}
        onScope={() => setPicking(true)}
        mondayPrefix={config.trackers.find((t) => t.monday)?.monday?.keyPrefix}
        now={now}
      />
    ) : section === "radar" ? (
      <RadarList
        view={radarView}
        onViewChange={setRadarView}
        tickets={tickets}
        days={calendar.events ? agendaDays(calendar.events, now) : null}
        notes={radarNotes}
        clientOrder={config.clients.map((c) => c.key)}
        systemName={systemName}
        scope={scope}
        onScope={() => setPicking(true)}
        showTracked={showTracked}
        onShowTracked={setShowTracked}
        planning={(t) =>
          commander.open(ticketRef(t)) ? "Commander is planning this" : null
        }
        onPlan={(t) =>
          void commander.planTracker({
            system: t.system,
            key: t.key,
            title: t.title,
            customer: t.client,
            url: t.url,
            status: t.status,
            priority: t.priority,
          })
        }
        onOpenTask={(t) => {
          if (!t.task) return;
          const band = t.task.band;
          setRange(
            band === "tomorrow"
              ? "tomorrow"
              : band === "today"
                ? "today"
                : "backlog",
          );
          setSection("missions");
          setSelected(taskKey(t.task));
        }}
      />
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
      counts={{
        shields: shieldAlerts(shieldRows(shieldData)),
      }}
      settingsOpen={settingsOpen}
      settings={
        <ConsoleSettings
          sound={prefs.sound}
          onSound={prefs.setSound}
          onPreview={prefs.preview}
          sync={syncLabel(
            {
              liveAt: worklist.liveAt,
              syncedAt: worklist.doc?.syncedAt ?? null,
            },
            now,
          )}
        />
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
            pullsLoading={pulls.loading}
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
              state === "done"
                ? actions.save(t, "task_done")
                : actions.save(t, "task_state", { state })
            }
            onAssess={(t, change) => actions.save(t, "task_assess", change)}
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
      soundOn={prefs.sound.enabled}
      onSound={() =>
        prefs.setSound({ ...prefs.sound, enabled: !prefs.sound.enabled })
      }
    />
  );
}
