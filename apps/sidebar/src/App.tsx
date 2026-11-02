import type { Runtime } from "@atlas/runtime";
import {
  ClientPill,
  GitHubList,
  HostsPanel,
  hostsTab,
  JiraList,
  MondayList,
  NextUp,
  readJira,
  releaseCount,
  ReleaseStatus,
  WaitingOnYou,
  Note,
  Panel,
  SidebarFrame,
  SidebarHeader,
  TabPanel,
  Tabs,
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
import { useGitHub } from "./useGitHub";
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
  now = new Date(),
}: AppProps) {
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
    typeof d === "object" && d !== null ? (d as { syncedAt?: string }) : null,
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
          liveAt: null,
          syncedAt: null,
          error: sync && "error" in sync ? sync.error : null,
        }}
      />
      <NextUp
        state="next"
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
          ...(v.id === "release" ? { count: releaseCount(release.data) } : {}),
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
            <Panel
              title={v.label}
              notes={
                <WaitingOnYou
                  operator={config.operator ?? "you"}
                  rows={waitingRows(
                    waiting.data?.items ?? [],
                    focus,
                    config,
                    clientOf,
                  )}
                />
              }
              loading
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
    </SidebarFrame>
  );
}

/** YYYY-MM-DD in local time. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
