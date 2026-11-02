import type { Runtime } from "@atlas/runtime";
import {
  ClientPill,
  HostsPanel,
  hostsTab,
  NextUp,
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
import { KEYS, load, save } from "./storage";
import { useHosts } from "./useHosts";
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
  const shownHosts = hosts.doc
    ? hostsFor(hosts.doc.hosts, focus, config)
    : null;
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
      <SidebarHeader now={now} sync={{ liveAt: null, syncedAt: null }} />
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
              doc={hosts.doc}
              hosts={shownHosts ?? []}
              live={hosts.live}
              error={hosts.error}
              allClients={focus === "all"}
              clientOf={(h) => clientOf(h.customer ?? h.clientId)}
              now={now}
            />
          ) : (
            <Panel title={v.label} loading />
          )}
        </TabPanel>
      ))}
    </SidebarFrame>
  );
}
