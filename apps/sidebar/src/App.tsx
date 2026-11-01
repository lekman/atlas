import type { Runtime } from "@atlas/runtime";
import {
  ClientPill,
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
import { KEYS, load, save } from "./storage";
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
          <Panel title={v.label} loading />
        </TabPanel>
      ))}
    </SidebarFrame>
  );
}
