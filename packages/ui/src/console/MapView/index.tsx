import type { Dataset } from "@atlas/core";
import { astronomer, Scene } from "@atlas/worlds";
import { useEffect, useRef, useState } from "react";

import { WorldCanvas } from "../../components/WorldCanvas";

export interface MapViewProps {
  /** The map's data from Atlas, or null before the host answered. */
  dataset: Dataset | null;
  /** Why the map is missing or old, in words. */
  note?: string | null;
  /** The page's system key for an Atlas client id, or null when it has none. */
  systemOf(clientId: string): string | null;
  /** The system the console is narrowed to, by the page's key. */
  scope: string | null;
  systemName(system: string): string;
  /** Narrows the console to a system. */
  onScope(system: string): void;
  /** Opens an agent in Agents. */
  onOpenAgent(agentId: string): void;
  /** Opens a task in Missions, by its worklist ref. */
  onOpenTask(ref: string): void;
}

type Card =
  | { kind: "system"; clientId: string }
  | { kind: "agent"; id: string }
  | { kind: "task"; id: string };

/** The ref Missions knows a task database item by. */
const taskRef = (itemId: string) => `db:${itemId}`;

const stateWords: Record<string, string> = {
  todo: "To do",
  doing: "In progress",
  review: "In review",
  done: "Done",
};

const agentWords: Record<string, string> = {
  running: "Working",
  watching: "Watching",
  waiting: "Waiting on you",
  blocked: "Blocked",
  error: "Error",
  idle: "Idle",
};

/**
 * The Map: the star map of every system, its open work as planets and its
 * agents as ships, filling the screen. A tap opens a summary card on the
 * right; the card's buttons narrow the console to the system, or open the
 * agent or the task in its tab. Picking a system with the scope button
 * flies the map to it.
 */
export function MapView({
  dataset,
  note = null,
  systemOf,
  scope,
  systemName,
  onScope,
  onOpenAgent,
  onOpenTask,
}: MapViewProps) {
  const scene = useRef<Scene | null>(null);
  if (!scene.current && dataset) scene.current = new Scene(dataset);
  useEffect(() => {
    if (dataset && scene.current && scene.current.dataset !== dataset)
      scene.current.reset(dataset);
  }, [dataset]);
  const [card, setCard] = useState<Card | null>(null);
  const [zoom, setZoom] = useState<{ clientId: string; request: number }>();
  // The scope button flies the map to the system picked.
  const scopedClient =
    dataset?.clients.find((c) => systemOf(c.id) === scope)?.id ?? null;
  useEffect(() => {
    if (scopedClient) setZoom({ clientId: scopedClient, request: Date.now() });
  }, [scopedClient]);

  if (!dataset || !scene.current)
    return (
      <div className="console-map">
        <p className="console-empty">{note ?? "Reading the map…"}</p>
      </div>
    );

  const working = dataset.agents.filter(
    (a) => !a.parentId && a.status === "running",
  ).length;
  const waiting = dataset.agents.filter(
    (a) => !a.parentId && a.status === "waiting",
  ).length;
  const select = (id: string | null) => {
    if (!id) return setCard(null);
    if (dataset.clients.some((c) => c.id === id))
      return setCard({ kind: "system", clientId: id });
    if (dataset.agents.some((a) => a.id === id))
      return setCard({ kind: "agent", id });
    if (dataset.items.some((i) => i.id === id))
      return setCard({ kind: "task", id });
    // A workstream or a group: its system's card.
    const owner =
      dataset.workstreams.find((w) => w.id === id)?.clientId ??
      dataset.groups.find((g) => g.id === id)?.clientId;
    setCard(owner ? { kind: "system", clientId: owner } : null);
  };

  return (
    <div className="console-map">
      <WorldCanvas
        scene={scene.current}
        world={astronomer}
        detail="full"
        lighting="night"
        selectedId={
          card ? (card.kind === "system" ? card.clientId : card.id) : null
        }
        onSelect={select}
        onOpenSystem={(clientId) => select(clientId)}
        onSystemTap={(clientId) => select(clientId)}
        zoomClientId={zoom?.clientId ?? null}
        zoomRequest={zoom?.request ?? 0}
        label={`Star map of ${dataset.clients.length} systems`}
      />
      <p className="console-map-counts" role="status">
        {[
          `${dataset.clients.length} system${dataset.clients.length === 1 ? "" : "s"}`,
          `${working} agent${working === 1 ? "" : "s"} working`,
          `${waiting} waiting on you`,
          ...(note ? [note] : []),
        ].join(" · ")}
      </p>
      {card ? (
        <MapCard
          card={card}
          dataset={dataset}
          systemOf={systemOf}
          systemName={systemName}
          scope={scope}
          onClose={() => setCard(null)}
          onScope={onScope}
          onOpenAgent={onOpenAgent}
          onOpenTask={onOpenTask}
        />
      ) : null}
    </div>
  );
}

function MapCard({
  card,
  dataset,
  systemOf,
  systemName,
  scope,
  onClose,
  onScope,
  onOpenAgent,
  onOpenTask,
}: {
  card: Card;
  dataset: Dataset;
  systemOf(clientId: string): string | null;
  systemName(system: string): string;
  scope: string | null;
  onClose(): void;
  onScope(system: string): void;
  onOpenAgent(agentId: string): void;
  onOpenTask(ref: string): void;
}) {
  const clientName = (clientId: string) => {
    const key = systemOf(clientId);
    return key
      ? systemName(key)
      : (dataset.clients.find((c) => c.id === clientId)?.name ?? clientId);
  };
  const clientOfGroup = (groupId: string) =>
    dataset.groups.find((g) => g.id === groupId)?.clientId ?? null;
  let title = "";
  let facts: Array<[string, string]> = [];
  let body: string | null = null;
  let actions: Array<{ label: string; run(): void }> = [];

  if (card.kind === "system") {
    const key = systemOf(card.clientId);
    const agents = dataset.agents.filter(
      (a) => !a.parentId && clientOfGroup(a.groupId) === card.clientId,
    );
    const open = dataset.items.filter(
      (i) => i.clientId === card.clientId && i.state !== "done",
    );
    title = clientName(card.clientId);
    facts = [
      ["Agents", String(agents.length)],
      ["Working", String(agents.filter((a) => a.status === "running").length)],
      [
        "Waiting on you",
        String(agents.filter((a) => a.status === "waiting").length),
      ],
      ["Open tasks", String(open.length)],
      ["In progress", String(open.filter((i) => i.state === "doing").length)],
    ];
    if (key && key !== scope)
      actions = [{ label: "Narrow to this system", run: () => onScope(key) }];
  } else if (card.kind === "agent") {
    const agent = dataset.agents.find((a) => a.id === card.id);
    if (!agent) return null;
    const clientId = clientOfGroup(agent.groupId);
    title = agent.name;
    facts = [
      ["Status", agentWords[agent.status] ?? agent.status],
      ...(clientId
        ? [["System", clientName(clientId)] as [string, string]]
        : []),
      ["Machine", agent.host],
      ["Working on", String(agent.workingOn.length)],
    ];
    body = agent.note || null;
    actions = [{ label: "Open in Agents", run: () => onOpenAgent(agent.id) }];
  } else {
    const item = dataset.items.find((i) => i.id === card.id);
    if (!item) return null;
    const by = dataset.agents.filter(
      (a) => !a.parentId && a.workingOn.includes(item.id),
    );
    title = item.title;
    facts = [
      ["Status", stateWords[item.state] ?? item.state],
      ["System", clientName(item.clientId)],
      ...(item.priority
        ? [["Priority", item.priority] as [string, string]]
        : []),
      ...(by.length
        ? [["Agent", by.map((a) => a.name).join(", ")] as [string, string]]
        : []),
    ];
    actions = [
      { label: "Open in Missions", run: () => onOpenTask(taskRef(item.id)) },
    ];
  }

  return (
    <aside className="console-map-card" aria-label={title}>
      <header className="console-map-card-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="console-map-close"
          aria-label="Close the card"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <dl className="console-facts">
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {body ? <p className="console-map-card-body">{body}</p> : null}
      {actions.length ? (
        <div
          className="console-detail-actions console-beam-actions"
          role="group"
          aria-label="Card actions"
        >
          {actions.map((a, n) => (
            <button
              key={a.label}
              type="button"
              className={n === 0 ? "console-primary" : "console-secondary"}
              onClick={a.run}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
