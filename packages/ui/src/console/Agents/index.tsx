import { useId, useState } from "react";

import { formatAgo } from "../../sidebar/format";
import type { WorkItem } from "../../sidebar/worklist/model";
import { ConsoleMenu, type MenuItem } from "../ConsoleMenu";
import { TaskRow } from "../TaskRow";
import { SectionHeading } from "../SectionHeading";
import { LiveMap } from "./LiveMap";
import { AgentMessages } from "./Messages";
import {
  AGENT_STATE_WORDS,
  agentsBySystem,
  agentState,
  type AgentFeedItem,
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
  /** Whether idle agents are hidden. */
  hideIdle?: boolean;
  onHideIdle?(hide: boolean): void;
  /** The systems in the order the page lists them. */
  clientOrder?: readonly string[];
  /** Systems whose group is folded. */
  folded?: ReadonlySet<string>;
  onFold?(folded: ReadonlySet<string>): void;
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
 * Agents: every agent by system, busiest first, each with the machine it
 * runs on, what it is doing and its latest activity, and a menu to message
 * it, nudge it or open its task. A system's heading folds its group; with a
 * system picked there are no headings. Offline agents are hidden until the
 * filter shows them, and the filter can hide idle ones too.
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
  hideIdle = false,
  onHideIdle = () => {},
  clientOrder = [],
  folded = new Set(),
  onFold = () => {},
  onMessage,
  onNudge,
  openTask = () => null,
  pendingId = null,
  now,
}: AgentsListProps) {
  const inScope = (agents ?? []).filter((a) => !scope || a.customer === scope);
  const offline = inScope.filter((a) => agentState(a) === "offline").length;
  const idle = inScope.filter((a) => agentState(a) === "idle").length;
  const shown = inScope.filter((a) => {
    const state = agentState(a);
    return (
      (showOffline || state !== "offline") && (!hideIdle || state !== "idle")
    );
  });

  return (
    <div className="console-agents">
      <SectionHeading
        title="Agents"
        scope={scope ? systemName(scope) : null}
        {...(onScope ? { onScope } : {})}
      >
        <ConsoleMenu
          label="Filter"
          name="the agents"
          icon="filter"
          buttonClassName="console-chip console-icon-chip"
          items={[
            {
              label: `Show offline (${offline})`,
              checked: showOffline,
              onSelect: () => onShowOffline(!showOffline),
            },
            {
              label: `Hide idle (${idle})`,
              checked: hideIdle,
              onSelect: () => onHideIdle(!hideIdle),
            },
          ]}
        />
      </SectionHeading>
      {notes.map((n) => (
        <p key={n} className="console-request" role="status">
          {n}
        </p>
      ))}
      {agents === null ? (
        <p className="console-empty">Reading the agents…</p>
      ) : shown.length === 0 ? (
        <p className="console-empty">
          {inScope.length ? "No agent is online." : "No agents to show."}
        </p>
      ) : (
        agentsBySystem(shown, clientOrder).map((group) => {
          const isFolded = !scope && folded.has(group.system);
          return (
            <section
              key={group.system}
              className="console-group"
              aria-label={systemName(group.system)}
            >
              {scope ? null : (
                <h2 className="console-group-title">
                  <button
                    type="button"
                    className="console-group-toggle"
                    aria-expanded={!isFolded}
                    onClick={() => {
                      const next = new Set(folded);
                      if (isFolded) next.delete(group.system);
                      else next.add(group.system);
                      onFold(next);
                    }}
                  >
                    <span className="console-group-chevron" aria-hidden="true">
                      {isFolded ? "▸" : "▾"}
                    </span>
                    {systemName(group.system)}
                  </button>
                  <span className="console-group-count">
                    {group.agents.length}
                  </span>
                </h2>
              )}
              {isFolded ? null : (
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
                      ...(open
                        ? [{ label: "Open its task", onSelect: open }]
                        : []),
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
                          aria-current={
                            a.id === selectedId ? "true" : undefined
                          }
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
                            <span className="console-task-fact">{a.host}</span>
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
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

export interface AgentDetailProps {
  agent: AgentRecord;
  systemName(client: string): string;
  /** The agent's tasks on the worklist, by ref. */
  taskFor?(ref: string): WorkItem | null;
  onOpenTask?(ref: string): void;
  /** A task row's actions and the line under them, as in Missions. */
  taskActions?(task: WorkItem): readonly MenuItem[];
  taskActionsFooter?(task: WorkItem): string | undefined;
  /** The monday.com key prefix, to tell its keys from Jira's. */
  mondayPrefix?: string;
  onMessage(text: string): void;
  onNudge(): void;
  /** An action on its way: the buttons wait, nothing else changes. */
  pending?: boolean;
  /** What happened to the last action, in words. */
  result?: { text: string; tone: "ok" | "bad" } | null;
  /** What the agent told Atlas, newest first, or null before the host answered. */
  feed?: readonly AgentFeedItem[] | null;
  /** Why the feed is missing or old. */
  feedNote?: string | null;
  /** Whether answered and withdrawn questions show. */
  showClosed?: boolean;
  onShowClosed?(show: boolean): void;
  /** Opens one of its open questions in Beam. */
  onOpenQuestion?(id: string): void;
  now: Date;
}

/**
 * One agent in full: its state, system, machine, what it is doing, how
 * long its session has run, its latest tool call and how many it has made,
 * the tasks it works on, its live view, and the messages it sent, such as
 * questions and done, error or waiting reports. A message box sends it a
 * message; Nudge asks it for a status; each runs through Commander's relay.
 */
export function AgentDetail({
  agent,
  systemName,
  taskFor = () => null,
  onOpenTask,
  taskActions = () => [],
  taskActionsFooter = () => undefined,
  mondayPrefix,
  onMessage,
  onNudge,
  pending = false,
  result = null,
  feed = null,
  feedNote = null,
  showClosed = false,
  onShowClosed = () => {},
  onOpenQuestion,
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
      <div className="console-detail-body console-agent-body">
        <div className="console-agent-column">
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
              <ul className="console-tasks">
                {agent.refs.map((ref) => {
                  const task = taskFor(ref);
                  if (!task)
                    return (
                      <li key={ref} className="console-note">
                        {ref}
                      </li>
                    );
                  const footer = taskActionsFooter(task);
                  return (
                    <TaskRow
                      key={ref}
                      task={task}
                      mondayPrefix={mondayPrefix}
                      actions={taskActions(task)}
                      {...(footer ? { actionsFooter: footer } : {})}
                      onSelect={() => onOpenTask?.(ref)}
                    />
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
        <div className="console-agent-column">
          <section className="console-detail-section" aria-label="Live">
            <h3 className="console-label">Live</h3>
            <LiveMap agent={agent} now={now} />
          </section>
          <AgentMessages
            items={feed}
            note={feedNote}
            showClosed={showClosed}
            onShowClosed={onShowClosed}
            {...(onOpenQuestion ? { onOpenQuestion } : {})}
            now={now}
          />
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
              {agent.refs?.length && onOpenTask && taskFor(agent.refs[0]!) ? (
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
      </div>
    </article>
  );
}
