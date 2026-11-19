import { useId, useState } from "react";

import { formatAgo } from "../../sidebar/format";
import { ConsoleMenu, type MenuItem } from "../ConsoleMenu";
import { SectionHeading } from "../SectionHeading";
import {
  AGENT_STATE_WORDS,
  agentsByHost,
  agentState,
  type AgentRecord,
} from "../agent-state";

export interface AgentsListProps {
  /** Every agent, or null before the host answered. */
  agents: readonly AgentRecord[] | null;
  notes?: readonly string[];
  systemName(client: string): string;
  scope: string | null;
  onScope?(): void;
  selectedId: string | null;
  onSelect(agent: AgentRecord): void;
  /** Whether offline agents show too. */
  showOffline: boolean;
  onShowOffline(show: boolean): void;
  onMessage(agent: AgentRecord): void;
  onNudge(agent: AgentRecord): void;
  /** Opens the agent's task, when one of its tasks is on the worklist. */
  openTask?(agent: AgentRecord): (() => void) | null;
  /** An action on its way to an agent: its id, so its menu waits. */
  pendingId?: string | null;
  now: Date;
}

const toneOf = (state: ReturnType<typeof agentState>) =>
  state === "working" ? "moving" : state === "waiting" ? "blocked" : "waiting";

/**
 * Agents: every agent by the machine it runs on, busiest first, each with
 * its system, what it is doing and its latest activity, and a menu to
 * message it, nudge it or open its task. Offline agents are hidden until
 * the filter shows them.
 */
export function AgentsList({
  agents,
  notes = [],
  systemName,
  scope,
  onScope,
  selectedId,
  onSelect,
  showOffline,
  onShowOffline,
  onMessage,
  onNudge,
  openTask = () => null,
  pendingId = null,
  now,
}: AgentsListProps) {
  const inScope = (agents ?? []).filter((a) => !scope || a.customer === scope);
  const offline = inScope.filter((a) => agentState(a) === "offline").length;
  const shown = showOffline
    ? inScope
    : inScope.filter((a) => agentState(a) !== "offline");

  return (
    <div className="console-agents">
      <SectionHeading
        title="Agents"
        scope={scope ? systemName(scope) : null}
        {...(onScope ? { onScope } : {})}
      />
      <div className="console-toolbar">
        <span />
        <ConsoleMenu
          label="Filter"
          name="the agents"
          items={[
            {
              label: `Show offline (${offline})`,
              checked: showOffline,
              onSelect: () => onShowOffline(!showOffline),
            },
          ]}
        />
      </div>
      {notes.map((n) => (
        <p key={n} className="console-request" role="status">
          {n}
        </p>
      ))}
      {!showOffline && offline > 0 && agents ? (
        <p className="console-hidden-note">
          {offline} offline hidden by the filter
        </p>
      ) : null}
      {agents === null ? (
        <p className="console-empty">Reading the agents…</p>
      ) : shown.length === 0 ? (
        <p className="console-empty">
          {inScope.length ? "No agent is online." : "No agents to show."}
        </p>
      ) : (
        agentsByHost(shown).map((group) => (
          <section
            key={group.host}
            className="console-group"
            aria-label={group.host}
          >
            <h2 className="console-group-title">
              <span>{group.host}</span>
              <span className="console-group-count">{group.agents.length}</span>
            </h2>
            <ul className="console-tasks">
              {group.agents.map((a) => {
                const state = agentState(a);
                const last = a.session?.activity?.lastCallAt;
                const open = openTask(a);
                const busy = pendingId === a.id;
                const items: MenuItem[] = [
                  {
                    label: "Message",
                    onSelect: () => onMessage(a),
                    disabled: busy,
                  },
                  {
                    label: "Nudge",
                    onSelect: () => onNudge(a),
                    disabled: busy,
                  },
                  ...(open ? [{ label: "Open its task", onSelect: open }] : []),
                ];
                return (
                  <li
                    key={a.id}
                    className="console-task console-agent"
                    data-selected={a.id === selectedId || undefined}
                  >
                    <button
                      type="button"
                      className="console-task-open"
                      aria-current={a.id === selectedId ? "true" : undefined}
                      onClick={() => onSelect(a)}
                    >
                      <span className="console-task-title">{a.name}</span>
                      <span className="console-task-meta">
                        <span
                          className="console-badge"
                          data-tone={toneOf(state)}
                        >
                          {AGENT_STATE_WORDS[state]}
                        </span>
                        <span className="console-task-fact">
                          {systemName(a.customer)}
                        </span>
                        {last ? (
                          <span className="console-task-fact">
                            last call {formatAgo(new Date(last), now)}
                          </span>
                        ) : null}
                      </span>
                      {a.note ? (
                        <span
                          className="console-agent-note console-clip"
                          title={a.note}
                        >
                          {a.note}
                        </span>
                      ) : null}
                    </button>
                    <span className="console-task-side">
                      <ConsoleMenu
                        label="Actions"
                        name={a.name}
                        items={items}
                        buttonClassName="console-task-move"
                        icon="more"
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export interface AgentDetailProps {
  agent: AgentRecord;
  systemName(client: string): string;
  /** Titles of the agent's tasks on the worklist, by ref. */
  taskTitle?(ref: string): string | null;
  onOpenTask?(ref: string): void;
  onMessage(text: string): void;
  onNudge(): void;
  /** An action on its way: the buttons wait, nothing else changes. */
  pending?: boolean;
  /** What happened to the last action, in words. */
  result?: { text: string; tone: "ok" | "bad" } | null;
  now: Date;
}

/**
 * One agent in full: its state, system, machine, what it is doing, how
 * long its session has run, its latest tool call and how many it has made,
 * and the tasks it works on. A message box sends it a message; Nudge asks
 * it for a status; each runs through Commander's relay.
 */
export function AgentDetail({
  agent,
  systemName,
  taskTitle = () => null,
  onOpenTask,
  onMessage,
  onNudge,
  pending = false,
  result = null,
  now,
}: AgentDetailProps) {
  const name = useId();
  const [text, setText] = useState("");
  const state = agentState(agent);
  const activity = agent.session?.activity;
  const facts: Array<[string, React.ReactNode]> = [
    ["Status", AGENT_STATE_WORDS[state]],
    ["System", systemName(agent.customer)],
    ["Machine", agent.host],
  ];
  if (agent.session?.since)
    facts.push(["Since", formatAgo(new Date(agent.session.since), now)]);
  if (activity?.startedAt)
    facts.push([
      "Session",
      `started ${formatAgo(new Date(activity.startedAt), now)}`,
    ]);
  if (activity?.lastCallAt)
    facts.push(["Last call", formatAgo(new Date(activity.lastCallAt), now)]);
  if (typeof activity?.toolCalls === "number")
    facts.push(["Tool calls", String(activity.toolCalls)]);

  return (
    <article
      className="console-detail console-agent-detail"
      aria-labelledby={`${name}-title`}
    >
      <header className="console-detail-head">
        <h2 id={`${name}-title`}>{agent.name}</h2>
      </header>
      <div className="console-detail-body">
        <dl className="console-facts">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {agent.note ? (
          <section className="console-detail-section" aria-label="Doing">
            <h3 className="console-label">Doing</h3>
            <p className="console-agent-doing">{agent.note}</p>
          </section>
        ) : null}
        {agent.refs?.length ? (
          <section className="console-detail-section" aria-label="Working on">
            <h3 className="console-label">Working on</h3>
            <ul className="console-agent-tasks">
              {agent.refs.map((ref) => {
                const title = taskTitle(ref);
                return (
                  <li key={ref}>
                    {title && onOpenTask ? (
                      <button
                        type="button"
                        className="console-read-more"
                        onClick={() => onOpenTask(ref)}
                      >
                        {title}
                      </button>
                    ) : (
                      <span className="console-note">{title ?? ref}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        <form
          className="console-detail-section console-agent-message"
          aria-label={`Message ${agent.name}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() || pending) return;
            onMessage(text.trim());
            setText("");
          }}
        >
          <h3 className="console-label">Message</h3>
          <label className="console-beam-note">
            <span className="console-visually-hidden">
              Your message to {agent.name}
            </span>
            <textarea
              rows={3}
              maxLength={4000}
              value={text}
              placeholder={`Write to ${agent.name}`}
              disabled={pending}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div
            className="console-detail-actions console-beam-actions"
            role="group"
            aria-label="Agent actions"
          >
            <button
              type="submit"
              className="console-primary"
              aria-disabled={!text.trim() || pending || undefined}
            >
              Send
            </button>
            <button
              type="button"
              className="console-secondary"
              aria-disabled={pending || undefined}
              title="Ask it for a status"
              onClick={() => !pending && onNudge()}
            >
              Nudge
            </button>
            {agent.refs?.length && onOpenTask && taskTitle(agent.refs[0]!) ? (
              <button
                type="button"
                className="console-secondary"
                onClick={() => onOpenTask(agent.refs![0]!)}
              >
                Open its task
              </button>
            ) : null}
          </div>
          {result ? (
            <p
              className="console-beam-status"
              data-tone={result.tone}
              role="status"
            >
              {result.text}
            </p>
          ) : null}
        </form>
      </div>
    </article>
  );
}
