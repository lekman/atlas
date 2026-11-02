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
  DetailsView,
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
import { useMemo, useState } from "react";

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
  const openItem = opened
    ? (worklist.doc?.items.find((t) => t.ref && t.ref === opened.ref) ?? opened)
    : null;
  const details = useDetails(runtime, openItem, detailsIndex?.items ?? {});
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
    <SidebarFrame fill>
      <SidebarHeader
        now={now}
        sync={{
          liveAt: worklist.liveAt,
          syncedAt: worklist.doc?.syncedAt ?? null,
          error: sync && "error" in sync ? sync.error : null,
        }}
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
              notes={
                <>
                  <WaitingOnYou
                    operator={config.operator ?? "you"}
                    rows={waitingRows(
                      waiting.data?.items ?? [],
                      focus,
                      config,
                      clientOf,
                    ).map((row) => {
                      // A waiting task opens its details once the worklist has it.
                      const task =
                        row.item.kind === "task" && row.item.ref
                          ? workItems?.find((t) => t.ref === row.item.ref)
                          : undefined;
                      return task
                        ? { ...row, onOpen: () => setOpened(task) }
                        : row;
                    })}
                  />
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
          onClose={() => setOpened(null)}
        />
      )}
    </SidebarFrame>
  );
}

/** YYYY-MM-DD in local time. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
