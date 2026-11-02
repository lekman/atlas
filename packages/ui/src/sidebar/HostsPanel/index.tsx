import { useState } from "react";

import { formatAgo, formatTime } from "../format";
import { HostCard } from "../HostCard";
import type { HostStat, HostsDoc } from "../hosts/model";
import { Note } from "../Note";
import { Panel } from "../Panel";

export interface HostsPanelProps {
  /** The live answer or the stored copy; null before either arrives. */
  doc: HostsDoc | null;
  /** The hosts this client focus shows, from `doc`. */
  hosts: readonly HostStat[];
  /** False when `doc` is the stored copy. */
  live: boolean;
  /** Why the live read failed, already in words. */
  error?: { text: string; tone: "warn" | "err" } | null;
  /** True while every client is shown. */
  allClients: boolean;
  clientOf: (host: HostStat) => { name: string; colour: string };
  now: Date;
}

/**
 * The hosts: collapsed cards with status dots, one open at a time. A stored
 * copy says how old it is, once, at the top.
 */
export function HostsPanel({
  doc,
  hosts,
  live,
  error,
  allClients,
  clientOf,
  now,
}: HostsPanelProps) {
  const [open, setOpen] = useState<string | null>(null);
  const storedAt = !live && doc?.storedAt ? new Date(doc.storedAt) : null;

  const notes = (
    <>
      {error && (
        <Note tone={error.tone}>
          {doc ? `Showing the stored copy: ${error.text}` : error.text}
        </Note>
      )}
      {doc && !live && (
        <Note>
          {storedAt
            ? `Stored copy from ${formatTime(storedAt)}, ${formatAgo(storedAt, now)}. Live numbers load while this page is open on the Mac.`
            : "Stored copy. Live numbers load while this page is open on the Mac."}
        </Note>
      )}
    </>
  );

  const title = "Hosts · CPU, memory and disk";
  if (!doc) {
    return (
      <Panel title={title} notes={notes}>
        <div className="blank">
          {error
            ? "No host statistics yet. They load while this page is open on the Mac."
            : "Loading host statistics…"}
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title={title}
      sub={`${hosts.length} host${hosts.length === 1 ? "" : "s"}`}
      notes={notes}
    >
      {hosts.length === 0 ? (
        <div className="blank">
          {allClients
            ? "No host has sent a sample yet."
            : "No host for this client."}
        </div>
      ) : (
        <div className="hosts">
          {hosts.map((host) => {
            const key = `${host.clientId}/${host.host}`;
            return (
              <HostCard
                key={key}
                host={host}
                client={clientOf(host)}
                open={open === key}
                onToggle={() => setOpen(open === key ? null : key)}
                now={now}
                live={live}
                storedAt={storedAt}
              />
            );
          })}
        </div>
      )}
    </Panel>
  );
}
