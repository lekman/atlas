import type { Runtime } from "@atlas/runtime";
import {
  Agenda,
  agendaDays,
  ClientPill,
  GitHubList,
  HostsPanel,
  hostsTab,
  JiraList,
  MondayList,
  nextEvent,
  NextUp,
  readJira,
  releaseCount,
  ReleaseStatus,
  WaitingOnYou,
  AskForm,
  askKey,
  askText,
  answeredView,
  answerOptions,
  AskView,
  DetailsView,
  HeaderButtons,
  SettingsView,
  syncLabel,
  ItemActions,
  RowButton,
  AssessForm,
  movable,
  quadrantOf,
  TriageView,
  trimPlan,
  whenOf,
  type Sizing,
  referenceText,
  RequestLine,
  type ItemAction,
  type MenuAction,
  pullCounts,
  PullRequests,
  type WaitingItem,
  type WorkItem,
  ActionMenu,
  isWaiting,
  openCount,
  Worklist,
  type Band,
  Note,
  Panel,
  SidebarFrame,
  SidebarHeader,
  TabPanel,
  Tabs,
  formatDay,
  formatDuration,
  formatTime,
  upcomingCount,
  visibleViews,
} from "@atlas/ui/sidebar";
import { useEffect, useMemo, useState } from "react";

import {
  clientColour,
  config as defaultConfig,
  type SidebarConfig,
} from "./config";
import { hostsFor } from "./hosts";
import { KEYS, load, loadSet, save, saveSet } from "./storage";
import { useCalendar } from "./useCalendar";
import { useWorklist } from "./useWorklist";
import { useDetails, useDetailsCopies, type DetailsIndex } from "./useDetails";
import { useCommander } from "./useCommander";
import { copyText, useTaskActions } from "./useTaskActions";
import { usePlanning } from "./usePlanning";
import { usePreferences } from "./usePreferences";
import {
  searchable,
  usePullRequests,
  usePullsRefresh,
} from "./usePullRequests";
import { foldAll, planFolds, worklistMeetings } from "./worklist";
import { useGitHub } from "./useGitHub";
import { useNow } from "./useNow";
import { useStored } from "./useStored";
import { useSync } from "./useSync";
import { useHosts } from "./useHosts";
import { useMonday } from "./useMonday";
import { useRelease } from "./useRelease";
import { useWaiting } from "./useWaiting";
import { waitingRows } from "./waiting";
import { sidebarViews, tabLook } from "./views";

export interface AppProps {
  runtime: Runtime;
  config?: SidebarConfig;
  now?: Date;
}

/** The sidebar. Each view's panel fills in as it reaches parity with the old page. */
export function App({
  runtime,
  config = defaultConfig,
  now: fixedNow,
}: AppProps) {
  const now = useNow(fixedNow);
  const views = useMemo(() => sidebarViews(config), [config]);
  const clients = useMemo(
    () =>
      config.clients.map((c) => ({
        key: c.key,
        name: c.name,
        colour: clientColour(c.key, config),
      })),
    [config],
  );
  const [focus, setFocus] = useState(
    () =>
      load(
        KEYS.focus,
        (v) => v === "all" || clients.some((c) => c.key === v),
      ) ?? "all",
  );
  const [view, setView] = useState(
    () => load(KEYS.view, (v) => views.some((x) => x.id === v)) ?? "worklist",
  );
  const shown = visibleViews(views, focus, view);
  const hosts = useHosts(runtime);
  const shownHosts = hosts.data
    ? hostsFor(hosts.data.hosts, focus, config)
    : null;
  const waiting = useWaiting(runtime);
  const release = useRelease(runtime);
  const mondayTracker = config.trackers.find((t) => t.monday);
  const monday = useMonday(runtime, mondayTracker?.monday);
  const githubTracker = config.trackers.find((t) => t.github);
  const github = useGitHub(runtime, githubTracker?.github);
  const [githubMine, setGithubMine] = useState(
    () => load(KEYS.githubMine, () => true) === "1",
  );
  // Saved with the previous page's `lb:` prefix, so its folds carry over.
  const [githubFolded, setGithubFolded] = useState(() =>
    loadSet(KEYS.githubFolded),
  );
  const jiraTracker = config.trackers.find((t) => t.logo === "jira");
  const jira = useStored(runtime, "board/jira", readJira);
  const events = useStored(runtime, "board/events", (d) =>
    typeof d === "object" && d !== null
      ? (d as { syncedAt?: string; items?: unknown })
      : null,
  );
  const sync = useSync(runtime, {
    jira: jira?.syncedAt,
    events: events?.syncedAt,
  });
  // "To do" starts folded until the operator chooses, as before.
  const [jiraFolded, setJiraFolded] = useState(() =>
    loadSet(KEYS.jiraFolded, ["cat:new"]),
  );
  // The client whose release status the sidebar shows, if any.
  const releaseClient = config.trackers.find((t) => t.release)?.client;
  const releaseView = (
    <ReleaseStatus
      doc={release.data}
      live={release.live}
      error={release.failure}
      now={now}
    />
  );
  const clientOf = (key: string) =>
    clients.find((c) => c.key === key) ?? {
      name: "Other",
      colour: "var(--client-other)",
    };
  const worklist = useWorklist(runtime, now);
  const detailsIndex = useStored(runtime, "board/details", (d) =>
    typeof d === "object" &&
    d !== null &&
    typeof (d as DetailsIndex).items === "object"
      ? (d as DetailsIndex)
      : null,
  );
  useDetailsCopies(
    runtime,
    worklist.doc?.items ?? null,
    worklist.liveAt,
    detailsIndex,
  );
  // The item whose details are open: the worklist's current copy of it when it has one.
  const [opened, setOpened] = useState<WorkItem | null>(null);
  // A Commander ask with no task to open, while its answer view is open.
  const [asking, setAsking] = useState<WaitingItem | null>(null);
  const openItem = opened
    ? (worklist.doc?.items.find((t) => t.ref && t.ref === opened.ref) ?? opened)
    : null;
  const details = useDetails(runtime, openItem, detailsIndex?.items ?? {});
  const commander = useCommander(runtime, config.inbox);
  const prefs = usePreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const syncState = {
    liveAt: worklist.liveAt,
    syncedAt: worklist.doc?.syncedAt ?? null,
    error: sync && "error" in sync ? sync.error : null,
  };
  const actions = useTaskActions(runtime, commander, worklist.apply);
  const planning = usePlanning(
    runtime,
    commander,
    worklist.doc?.items ?? null,
    worklist.apply,
  );
  const sizing = useStored(runtime, "board/sizing", (d) => {
    const items = (d as { items?: unknown } | null)?.items;
    return typeof items === "object" && items !== null
      ? (items as Record<string, Sizing>)
      : null;
  });
  // Triage: the ungraded tasks it was opened with, while it is open.
  const [triage, setTriage] = useState<readonly WorkItem[] | null>(null);
  const [assessOpen, setAssessOpen] = useState<string | null>(null);
  // A task a tracker row's button went to: its row is scrolled to and flashed once rendered.
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const row = document.querySelector<HTMLElement>(
      `.task[data-ref="${CSS.escape(flash)}"]`,
    );
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
    row?.classList.add("flash");
    const timer = setTimeout(() => {
      row?.classList.remove("flash");
      setFlash(null);
    }, 1600);
    return () => clearTimeout(timer);
  }, [flash]);
  const triageFor = (rows: readonly WorkItem[]) => {
    const ready = rows.filter((t) => sizing?.[String(t.ref).slice(3)]).length;
    return {
      label: `Triage ${rows.length}${ready ? ` (${ready} suggested)` : ""}`,
      hint: ready
        ? "Check the suggested value and effort, then save"
        : "No suggestions yet; grade them by hand",
      onSelect: () => setTriage(rows),
    };
  };
  // A short note above the worklist: what was copied, or that it couldn't be.
  const [workNote, setWorkNote] = useState<string | null>(null);
  useEffect(() => {
    if (!workNote?.startsWith("Copied: ")) return;
    const timer = setTimeout(() => setWorkNote(null), 3000);
    return () => clearTimeout(timer);
  }, [workNote]);
  const copyReference = async (t: WorkItem) => {
    const text = referenceText(t.title, t.key);
    setWorkNote(
      (await copyText(text))
        ? `Copied: ${text}`
        : "Could not copy to the clipboard in this view.",
    );
  };
  const HERE: Record<string, Band> = {
    today: "today",
    tomorrow: "tomorrow",
    future: "backlog",
    unscheduled: "backlog",
  };
  const MOVES: Record<
    Band,
    { icon: "today" | "right" | "doorout"; label: string }
  > = {
    today: { icon: "today", label: "Move to today" },
    tomorrow: { icon: "right", label: "Move to tomorrow" },
    backlog: { icon: "doorout", label: "Move to the backlog" },
  };
  const otherBands = (t: WorkItem) =>
    (["today", "tomorrow", "backlog"] as Band[]).filter(
      (b) => b !== (HERE[t.band ?? ""] ?? "today"),
    );
  const pendingNote = "A Commander request for this item is still open";
  const rowMenu = (t: WorkItem) => {
    if (t.done || !t.ref) return null;
    const open = Boolean(commander.open(t.ref));
    const items: MenuAction[] = [
      {
        label: "Copy reference",
        icon: "clip",
        hint: undefined,
        onSelect: () => {
          copyReference(t).catch(() => undefined);
        },
      },
      {
        label: "Done",
        divider: true,
        onSelect: () => actions.act(t, "task_done"),
      },
      ...otherBands(t).map((b) => ({
        label: `Move to ${b[0]!.toUpperCase()}${b.slice(1)}`,
        onSelect: () => actions.act(t, "task_move", { to: b }),
      })),
      {
        label: "Status",
        divider: true,
        disabled: open,
        onSelect: () => commander.send(t, "status"),
      },
      {
        label: "Execute",
        disabled: open,
        onSelect: () => commander.send(t, "execute"),
      },
    ];
    return (
      <ActionMenu
        what={t.title}
        actions={items}
        footer={open ? `${pendingNote}.` : undefined}
      />
    );
  };
  // One status per task: a claim is newer than the Commander request that led to it.
  const rowStatus = (t: WorkItem) =>
    t.claimedBy ? null : (
      <RequestLine request={commander.latest(t.ref)} now={now} />
    );
  // The answer form for an ask, with what happened to the last answer sent.
  const answerForm = (item: WaitingItem) => {
    const sent = commander.latest(askKey(item) ?? undefined);
    const last = sent?.action === "answer" ? sent : null;
    const from =
      item.kind === "commander" && item.worker ? item.worker : "Commander";
    const ask = askText(item, config.operator ?? "you").ask;
    return (
      <AskForm
        key={askKey(item) ?? item.ask}
        ask={ask}
        from={from}
        options={answerOptions(item, ask)}
        busy={last?.state === "sending"}
        sent={
          last && last.state !== "sending" && last.state !== "failed"
            ? { at: last.requestedAt, answer: last.answer ?? {} }
            : null
        }
        status={
          !last || last.state === "sending"
            ? null
            : last.state === "failed"
              ? { tone: "bad", text: last.summary || "Not sent." }
              : last.state === "done" || last.state === "answered"
                ? {
                    tone: "ok",
                    text: last.summary || `${from} has your answer.`,
                  }
                : {
                    tone: "warn",
                    text:
                      last.summary || `Sent; Commander hands it to ${from}.`,
                  }
        }
        onSend={(answer) => {
          commander.answer(item, answer).catch(() => undefined);
        }}
      />
    );
  };

  const detailActions = (t: WorkItem) => {
    if (t.done) {
      return (
        <div className="dacts">
          <span className="st done">done</span>
        </div>
      );
    }
    const open = Boolean(commander.open(t.ref));
    const busy = actions.busyRef === t.ref;
    const commanderGroup: ItemAction[] = [
      ...(t.details
        ? []
        : [
            {
              icon: "send" as const,
              label:
                "Plan with Commander: a details page with a test plan, or a refusal with the reason",
              primary: true,
              disabled: open || busy,
              why: pendingNote.toLowerCase(),
              onSelect: () => commander.plan(t),
            },
          ]),
      {
        icon: "play",
        label: "Execute: dispatch to the owner",
        primary: Boolean(t.details),
        disabled: open || busy,
        why: pendingNote.toLowerCase(),
        onSelect: () => commander.send(t, "execute"),
      },
      {
        icon: "pulse",
        label: "Status: ask the owner where this stands",
        disabled: open || busy,
        why: pendingNote.toLowerCase(),
        onSelect: () => commander.send(t, "status"),
      },
    ];
    const taskGroup: ItemAction[] = [
      {
        icon: "check",
        label: "Done",
        disabled: busy,
        onSelect: async () => {
          const fresh = await actions.act(t, "task_done");
          // Close the details once the fresh worklist has it done, or no longer has it.
          if (fresh && !fresh.items.some((x) => x.ref === t.ref && !x.done))
            setOpened(null);
        },
      },
      ...otherBands(t).map((b) => ({
        icon: MOVES[b].icon,
        label: MOVES[b].label,
        disabled: busy,
        onSelect: () => actions.act(t, "task_move", { to: b }),
      })),
    ];
    return (
      <>
        <ItemActions groups={[commanderGroup, taskGroup]} />
        {commander.latest(t.ref) && (
          <div className="dstatus">
            <RequestLine request={commander.latest(t.ref)} now={now} />
          </div>
        )}
      </>
    );
  };
  const pulls = usePullRequests(runtime, openItem);
  usePullsRefresh(runtime, worklist.doc?.items ?? null, worklist.liveAt);
  const workItems = worklist.doc?.items ?? null;
  const meetings = useMemo(
    () =>
      worklistMeetings(
        workItems ?? [],
        config.calendar?.timeZone ?? "Europe/London",
      ),
    [workItems, config],
  );
  const calendar = useCalendar(runtime, config, events, now, meetings);
  const [band, setBand] = useState<Band>(
    () =>
      (load(KEYS.band, (v) =>
        ["today", "tomorrow", "backlog"].includes(v),
      ) as Band | null) ?? "today",
  );
  const [workFolded, setWorkFolded] = useState(() =>
    loadSet(KEYS.worklistFolded),
  );
  const [showDone, setShowDone] = useState(
    () => load(KEYS.showDone, () => true) === "1",
  );
  const [showWaiting, setShowWaiting] = useState(
    () => load(KEYS.showWaiting, () => true) !== "0",
  );
  const fold = (next: Set<string>) => {
    setWorkFolded(next);
    saveSet(KEYS.worklistFolded, next);
  };
  const chooseBand = (b: Band) => {
    setBand(b);
    save(KEYS.band, b);
    // The first visit to the backlog opens its quadrants with each client closed.
    if (b === "backlog" && load(KEYS.planInit, (v) => v === "1") !== "1") {
      save(KEYS.planInit, "1");
      fold(
        planFolds(
          workFolded,
          config.clients.map((c) => c.key),
        ),
      );
    }
  };
  const inFocus = (key: string) => focus === "all" || key === focus;
  const shownEvents = calendar.events?.filter((e) => inFocus(e.client)) ?? null;
  const next = shownEvents ? nextEvent(shownEvents, now) : null;
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const samples = config.calendar?.samples;

  const choose = (key: string) => {
    setFocus(key);
    save(KEYS.focus, key);
  };
  const open = (id: string) => {
    setView(id);
    save(KEYS.view, id);
  };

  return (
    <SidebarFrame fill world={{ id: prefs.world, lighting: prefs.resolved }}>
      <SidebarHeader
        now={now}
        sync={syncState}
        controls={
          <HeaderButtons
            soundOn={prefs.sound.enabled}
            onSound={() =>
              prefs.setSound({ ...prefs.sound, enabled: !prefs.sound.enabled })
            }
            onSettings={() => setSettingsOpen(true)}
          />
        }
      />
      <NextUp
        state={next?.state ?? "next"}
        title={
          next
            ? `${next.event.title}${next.event.sample ? " (sample)" : ""}`
            : undefined
        }
        empty={shownEvents ? "Nothing in the next 7 days" : "—"}
        countdown={
          next
            ? next.state === "now"
              ? `ends in ${formatDuration(next.event.end.getTime() - now.getTime())}`
              : `in ${formatDuration(next.event.start.getTime() - now.getTime())}`
            : undefined
        }
        when={
          next
            ? `${next.event.start >= tomorrow ? `${formatDay(next.event.start)} ` : ""}${formatTime(next.event.start)}–${formatTime(next.event.end)} · ${clientOf(next.event.client).name}`
            : undefined
        }
        corner={
          <ClientPill clients={clients} focus={focus} onChoose={choose} />
        }
      />
      {!runtime.present && (
        <Note tone="warn">Live connectors aren't available in this view.</Note>
      )}
      <Tabs
        label="Views"
        idPrefix="sidebar"
        tabs={shown.views.map((v) => ({
          id: v.id,
          label: v.label,
          iconOnly: true,
          ...tabLook(config, v.id),
          ...(v.id === "hosts" ? hostsTab(shownHosts) : {}),
          // Tracker tabs count as the previous page did: Monday items not
          // done, Jira issues when the sync worked, GitHub's open total.
          ...(v.id === mondayTracker?.client && monday.data
            ? { count: String(monday.data.items.length) }
            : {}),
          ...(v.id === jiraTracker?.client && jira?.ok
            ? { count: String(jira.items.length) }
            : {}),
          ...(v.id === githubTracker?.client && github.data
            ? { count: String(github.data.total) }
            : {}),
          ...(v.id === "worklist" && workItems
            ? {
                count: String(
                  openCount(
                    workItems,
                    band,
                    dayKey(now),
                    dayKey(tomorrow),
                    inFocus,
                  ),
                ),
              }
            : {}),
          ...(v.id === "release" ? { count: releaseCount(release.data) } : {}),
          ...(v.id === "agenda" && shownEvents
            ? { count: String(upcomingCount(shownEvents, now)) }
            : {}),
        }))}
        selected={shown.selected}
        onSelect={open}
      />
      {shown.views.map((v) => (
        <TabPanel
          key={v.id}
          idPrefix="sidebar"
          id={v.id}
          selected={shown.selected}
        >
          {v.id === "hosts" ? (
            <HostsPanel
              doc={hosts.data}
              hosts={shownHosts ?? []}
              live={hosts.live}
              error={hosts.error}
              allClients={focus === "all"}
              clientOf={(h) => clientOf(h.customer ?? h.clientId)}
              now={now}
            />
          ) : v.id === "worklist" ? (
            <Worklist
              items={workItems}
              loading={workItems === null && worklist.pending}
              empty={
                runtime.present
                  ? "No worklist yet. Open this page in the Claude desktop app on your Mac, or wait for the scheduled sync."
                  : "The worklist needs the page's data store or the local server, and neither is available in this view."
              }
              band={band}
              onBand={chooseBand}
              clients={clients}
              focus={focus}
              folded={workFolded}
              onFold={(key) => {
                const next = new Set(workFolded);
                if (!next.delete(key)) next.add(key);
                fold(next);
              }}
              showDone={showDone}
              showWaiting={showWaiting}
              today={dayKey(now)}
              tomorrow={dayKey(tomorrow)}
              onOpen={setOpened}
              quadrantActions={(q, rows) => {
                const today = dayKey(now);
                const todays = rows.filter(
                  (t) => whenOf(t, today) === "today" && movable(t),
                );
                const tomorrows = rows.filter(
                  (t) => whenOf(t, today) === "tomorrow" && movable(t),
                );
                const later = rows.filter(
                  (t) => whenOf(t, today) !== "today" && movable(t),
                );
                const ungraded = rows.filter((t) =>
                  String(t.ref).startsWith("db:"),
                );
                return (
                  <ActionMenu
                    what={q === "unsized" ? "Ungraded" : q.slice(0, 2)}
                    footer={
                      runtime.present
                        ? undefined
                        : "Moves made here are queued and applied on the Mac mini within a minute."
                    }
                    actions={[
                      ...(q === "Q1-do-now"
                        ? [
                            {
                              label: `Plan ${later.length} for today`,
                              disabled: !later.length || planning.busy,
                              onSelect: () =>
                                planning.moveMany(
                                  later.map((t) => t.ref!),
                                  "today",
                                ),
                            },
                          ]
                        : []),
                      ...(q === "unsized"
                        ? [
                            {
                              ...triageFor(ungraded),
                              disabled: !ungraded.length,
                            },
                          ]
                        : []),
                      {
                        label: `Move ${todays.length} from today to the backlog`,
                        disabled: !todays.length || planning.busy,
                        onSelect: () =>
                          planning.moveMany(
                            todays.map((t) => t.ref!),
                            "backlog",
                          ),
                      },
                      {
                        label: `Move ${tomorrows.length} from tomorrow to the backlog`,
                        disabled: !tomorrows.length || planning.busy,
                        onSelect: () =>
                          planning.moveMany(
                            tomorrows.map((t) => t.ref!),
                            "backlog",
                          ),
                      },
                    ]}
                  />
                );
              }}
              rowActions={rowMenu}
              rowStatus={rowStatus}
              busyRef={actions.busyRef}
              notes={
                <>
                  <WaitingOnYou
                    operator={config.operator ?? "you"}
                    errors={waiting.data?.errors}
                    rows={waitingRows(
                      waiting.data?.items ?? [],
                      focus,
                      config,
                      clientOf,
                    )
                      .flatMap((row) => {
                        // An answered ask hides for ten minutes, then shows again marked late.
                        const key = askKey(row.item);
                        const sent = key ? commander.latest(key) : null;
                        const view = answeredView(
                          sent?.action === "answer" ? sent : null,
                          now,
                        );
                        if (view === "hide") return [];
                        return [
                          view === "late"
                            ? { ...row, answeredAt: sent!.requestedAt }
                            : row,
                        ];
                      })
                      .map((row) => {
                        // A waiting task opens its details once the worklist has it.
                        const task =
                          row.item.kind === "task" && row.item.ref
                            ? workItems?.find((t) => t.ref === row.item.ref)
                            : undefined;
                        if (task)
                          return { ...row, onOpen: () => setOpened(task) };
                        return row.item.kind !== "task" && askKey(row.item)
                          ? { ...row, onOpen: () => setAsking(row.item) }
                          : row;
                      })}
                  />
                  {workNote && (
                    <Note onClose={() => setWorkNote(null)}>{workNote}</Note>
                  )}
                  {planning.note && (
                    <Note
                      onClose={planning.busy ? undefined : planning.clearNote}
                    >
                      {planning.note}
                    </Note>
                  )}
                  {actions.error && (
                    <Note tone="err" onClose={actions.clearError}>
                      {actions.error}
                    </Note>
                  )}
                  {commander.error && (
                    <Note tone="err" onClose={commander.clearError}>
                      {commander.error}
                    </Note>
                  )}
                  {worklist.error && (
                    <Note tone="err">{worklist.error.text}</Note>
                  )}
                  {worklist.doc?.database?.ok === false && (
                    <Note tone="err">
                      The task database didn't answer, so clients that live
                      there are missing:{" "}
                      {worklist.doc.database.error || "no answer"}.
                    </Note>
                  )}
                </>
              }
              menu={
                workItems && (
                  <ActionMenu
                    what="the worklist"
                    actions={[
                      {
                        label: `${showDone ? "Hide" : "Show"} done (${
                          workItems.filter(
                            (t) => !t.meeting && t.done && inFocus(t.customer),
                          ).length
                        })`,
                        onSelect: () => {
                          setShowDone(!showDone);
                          save(KEYS.showDone, showDone ? "0" : "1");
                        },
                      },
                      {
                        label: `${showWaiting ? "Hide" : "Show"} approved and merged (${
                          workItems.filter(
                            (t) =>
                              !t.meeting &&
                              !t.done &&
                              inFocus(t.customer) &&
                              isWaiting(t),
                          ).length
                        })`,
                        hint: "Pull requests waiting for a merge or a release",
                        onSelect: () => {
                          setShowWaiting(!showWaiting);
                          save(KEYS.showWaiting, showWaiting ? "0" : "1");
                        },
                      },
                      {
                        label: "Collapse to clients",
                        hint: "In every view: each client closed; in Backlog, quadrants stay open",
                        onSelect: () =>
                          fold(
                            foldAll(
                              workFolded,
                              config.clients.map((c) => c.key),
                              true,
                            ),
                          ),
                      },
                      ...(() => {
                        const open = workItems.filter(
                          (t) => !t.meeting && !t.done && inFocus(t.customer),
                        );
                        const trim = trimPlan(
                          open.filter(
                            (t) => whenOf(t, dayKey(now)) === "today",
                          ),
                        );
                        const ungraded = open.filter(
                          (t) =>
                            quadrantOf(t) === "unsized" &&
                            String(t.ref).startsWith("db:"),
                        );
                        return [
                          {
                            label: `Trim today to one day (${trim.length})`,
                            hint: "Keeps Q1 and the highest Q2 that fits 8h; moves today's other graded tasks to the backlog. Ungraded tasks stay.",
                            disabled: !trim.length || planning.busy,
                            onSelect: () => planning.moveMany(trim, "backlog"),
                          },
                          {
                            ...triageFor(ungraded),
                            label: triageFor(ungraded).label.replace(
                              /^Triage (\d+)/,
                              "Triage $1 ungraded",
                            ),
                            disabled: !ungraded.length,
                          },
                        ];
                      })(),
                      {
                        label: "Expand all",
                        onSelect: () =>
                          fold(
                            foldAll(
                              workFolded,
                              config.clients.map((c) => c.key),
                              false,
                            ),
                          ),
                      },
                    ]}
                  />
                )
              }
            />
          ) : v.id === "agenda" ? (
            <Agenda
              days={shownEvents ? agendaDays(shownEvents, now) : null}
              scope={
                focus === "all"
                  ? "All customers"
                  : `${clientOf(focus).name} only`
              }
              notes={
                <>
                  {samples &&
                    calendar.usingSamples &&
                    inFocus(samples.client) && (
                      <Note tone="warn">
                        <span className="tag sample">sample</span>{" "}
                        {samples.note}
                      </Note>
                    )}
                  {calendar.errors.map((e) => (
                    <Note key={e.text} tone={e.tone}>
                      {e.text}
                    </Note>
                  ))}
                </>
              }
              clientOf={clientOf}
              now={now}
            />
          ) : v.id === "release" ? (
            releaseView
          ) : (
            <>
              {/* With every client shown, release status sits above its client's tracker. */}
              {v.id === releaseClient && focus === "all" && releaseView}
              {v.id === mondayTracker?.client ? (
                <MondayList
                  title={`${clientOf(v.id).name} · ${mondayTracker.title ?? "Monday, assigned to me"}`}
                  page={monday.data}
                  error={monday.error}
                  updatedAt={monday.updatedAt}
                  now={now}
                  rowAction={(item) => {
                    if (!item.key) return null;
                    const task = workItems?.find(
                      (t) => t.key === item.key && !t.meeting,
                    );
                    if (task) {
                      return (
                        <RowButton
                          icon="arrow"
                          label={`Open the task for ${item.key} in the worklist`}
                          title="Open the task in the worklist"
                          onClick={() => {
                            const b = HERE[task.band ?? ""] ?? "today";
                            setBand(b);
                            save(KEYS.band, b);
                            const next = new Set(workFolded);
                            next.delete(task.customer);
                            fold(next);
                            if (!inFocus(task.customer)) choose("all");
                            open("worklist");
                            setFlash(task.ref ?? null);
                          }}
                        />
                      );
                    }
                    const pending = Boolean(
                      commander.open(`monday:${item.key}`),
                    );
                    return (
                      <RowButton
                        icon="send"
                        label={
                          pending
                            ? `Commander is planning ${item.key}`
                            : `Plan ${item.key} with Commander`
                        }
                        title={
                          pending
                            ? "Commander is planning this"
                            : "Plan with Commander: it becomes a task with a details page, a test plan and a priority, or is refused with the reason"
                        }
                        disabled={pending}
                        onClick={() => {
                          commander
                            .planTracker({
                              system: "monday",
                              key: item.key!,
                              title: item.name,
                              customer: mondayTracker.client,
                              url: item.url,
                              status: item.status,
                              priority: item.priority,
                            })
                            .catch(() => undefined);
                        }}
                      />
                    );
                  }}
                  rowStatus={(item) =>
                    item.key &&
                    !workItems?.some(
                      (t) => t.key === item.key && !t.meeting,
                    ) ? (
                      <RequestLine
                        request={commander.latest(`monday:${item.key}`)}
                        now={now}
                      />
                    ) : null
                  }
                />
              ) : v.id === jiraTracker?.client ? (
                <JiraList
                  title={`${clientOf(v.id).name} · ${jiraTracker.title ?? "Jira, assigned to me"}`}
                  doc={jira}
                  folded={
                    new Set(
                      [...jiraFolded]
                        .filter((k) => k.startsWith("cat:"))
                        .map((k) => k.slice(4)),
                    )
                  }
                  onFold={(group) => {
                    const next = new Set(jiraFolded);
                    if (!next.delete(`cat:${group}`)) next.add(`cat:${group}`);
                    setJiraFolded(next);
                    saveSet(KEYS.jiraFolded, next);
                  }}
                  today={dayKey(now)}
                  now={now}
                />
              ) : v.id === githubTracker?.client && githubTracker.github ? (
                <GitHubList
                  title={`${clientOf(v.id).name} · ${githubTracker.title ?? "GitHub issues"}`}
                  repo={`${githubTracker.github.owner}/${githubTracker.github.name}`}
                  page={github.data}
                  error={github.error}
                  me={github.me}
                  mine={githubMine}
                  onMine={(mine) => {
                    setGithubMine(mine);
                    save(KEYS.githubMine, mine ? "1" : "0");
                  }}
                  folded={
                    new Set(
                      [...githubFolded]
                        .filter((k) => k.startsWith("lb:"))
                        .map((k) => k.slice(3)),
                    )
                  }
                  onFold={(label) => {
                    const next = new Set(githubFolded);
                    if (!next.delete(`lb:${label}`)) next.add(`lb:${label}`);
                    setGithubFolded(next);
                    saveSet(KEYS.githubFolded, next);
                  }}
                  colour={clientOf(v.id).colour}
                  updatedAt={github.updatedAt}
                  now={now}
                />
              ) : (
                <Panel title={v.label} loading />
              )}
            </>
          )}
        </TabPanel>
      ))}
      {asking && (
        <AskView
          item={asking}
          clientName={
            waitingRows([asking], "all", config, clientOf)[0]?.client.name ??
            "Other"
          }
          onClose={() => setAsking(null)}
        >
          {answerForm(asking)}
        </AskView>
      )}
      {openItem && (
        <DetailsView
          item={openItem}
          clientName={clientOf(openItem.customer).name}
          details={details}
          githubOrg={
            config.clients.find((c) => c.key === openItem.customer)?.githubOrg
          }
          mondayPrefix={
            config.trackers.find((t) => t.monday)?.monday?.keyPrefix
          }
          weekEnd={dayKey(new Date(now.getTime() + 7 * 86400000))}
          now={now}
          openPullRequests={pullCounts(pulls.doc).open}
          draftPullRequests={pullCounts(pulls.doc).draft}
          onClose={() => setOpened(null)}
          actions={detailActions(openItem)}
          onAssess={
            openItem.ref?.startsWith("db:")
              ? () =>
                  setAssessOpen(
                    assessOpen === openItem.ref ? null : (openItem.ref ?? null),
                  )
              : undefined
          }
          assessOpen={assessOpen === openItem.ref}
          assess={
            assessOpen === openItem.ref ? (
              <AssessForm
                item={openItem}
                canSave={runtime.present}
                onCancel={() => setAssessOpen(null)}
                onSave={(change) => {
                  setAssessOpen(null);
                  planning.assess(openItem, change).catch(() => undefined);
                }}
              />
            ) : planning.assessNote?.ref === openItem.ref ? (
              <div className="note" role="status">
                {planning.assessNote?.text}
              </div>
            ) : null
          }
          ask={(() => {
            const waits = waiting.data?.items.find(
              (w) => w.kind === "task" && w.ref && w.ref === openItem.ref,
            );
            return waits ? answerForm(waits) : null;
          })()}
          pullRequests={
            (openItem.key || searchable(openItem) || pulls.doc) && (
              <PullRequests
                doc={pulls.doc}
                copy={pulls.copy}
                trackerKey={openItem.key}
                searchable={searchable(openItem)}
                onRefresh={runtime.present ? () => pulls.refresh() : undefined}
                busy={pulls.busy}
                now={now}
              />
            )
          }
        />
      )}
      {settingsOpen && (
        <SettingsView
          world={prefs.world}
          onWorld={prefs.setWorld}
          lighting={prefs.lighting}
          onLighting={prefs.setLighting}
          deviceIsDark={prefs.deviceIsDark}
          sound={prefs.sound}
          onSound={prefs.setSound}
          onPreview={prefs.preview}
          sync={syncLabel(syncState, now)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {triage && (
        <TriageView
          items={(workItems ?? []).filter(
            (t) =>
              !t.done &&
              quadrantOf(t) === "unsized" &&
              String(t.ref).startsWith("db:") &&
              triage.some((x) => x.ref === t.ref),
          )}
          sizing={sizing ?? {}}
          clientOf={clientOf}
          clientOrder={config.clients.map((c) => c.key)}
          today={dayKey(now)}
          onSave={(grades) => {
            planning.grade(grades).catch(() => undefined);
          }}
          busy={planning.busy}
          note={planning.triageNote}
          onClose={() => setTriage(null)}
        />
      )}
    </SidebarFrame>
  );
}

/** YYYY-MM-DD in local time. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
