import type { Runtime } from "@atlas/runtime";
import {
  AssessForm,
  DetailsView,
  ItemActions,
  pullCounts,
  PullRequests,
  RequestLine,
  type ItemAction,
  type WaitingItem,
  type WorkItem,
} from "@atlas/ui/sidebar";
import { useState } from "react";

import { CommanderAnswer } from "./CommanderAnswer";
import type { SidebarConfig } from "./config";
import { dayKey } from "./day";
import { MOVES, otherBands, PENDING_NOTE } from "./moves";
import type { Commander } from "./useCommander";
import { useDetails } from "./useDetails";
import type { Planning } from "./usePlanning";
import { searchable, usePullRequests } from "./usePullRequests";
import type { TaskActions } from "./useTaskActions";

export interface TaskDetailsProps {
  runtime: Runtime;
  config: SidebarConfig;
  /** The task, as the worklist has it now. */
  item: WorkItem;
  /** The client's name, under the title. */
  clientName: string;
  now: Date;
  commander: Commander;
  actions: TaskActions;
  planning: Planning;
  /** What waits on the operator: a task's own ask shows in its details. */
  waiting: readonly WaitingItem[];
  /** The stored copies' index, `board/details`, for the page when the server can't be reached. */
  detailsIndex: Record<string, string>;
  /** Back and Escape; without it the details are the whole page, as in an editor tab. */
  onClose?: () => void;
  /** After Done, once the fresh worklist has the task done or no longer has it. */
  onDone?: () => void;
}

/**
 * One task's details with everything the sidebar does in them: the
 * Commander and task actions, the quadrant form, the task's ask and its
 * pull requests. The sidebar opens it over the worklist, and a VS Code
 * editor tab shows it as the whole page.
 */
export function TaskDetails({
  runtime,
  config,
  item,
  clientName,
  now,
  commander,
  actions,
  planning,
  waiting,
  detailsIndex,
  onClose,
  onDone,
}: TaskDetailsProps) {
  const details = useDetails(runtime, item, detailsIndex);
  const pulls = usePullRequests(runtime, item);
  const [assessOpen, setAssessOpen] = useState(false);
  const operator = config.operator ?? "you";
  const waits = waiting.find(
    (w) => w.kind === "task" && w.ref && w.ref === item.ref,
  );

  const detailActions = () => {
    if (item.done) {
      return (
        <div className="dacts">
          <span className="st done">done</span>
        </div>
      );
    }
    const open = Boolean(commander.open(item.ref));
    const busy = actions.busyRef === item.ref;
    const why = PENDING_NOTE.toLowerCase();
    const commanderGroup: ItemAction[] = [
      ...(item.details
        ? []
        : [
            {
              icon: "send" as const,
              label:
                "Plan with Commander: a details page with a test plan, or a refusal with the reason",
              primary: true,
              disabled: open || busy,
              why,
              onSelect: () => commander.plan(item),
            },
          ]),
      {
        icon: "play",
        label: "Execute: dispatch to the owner",
        primary: Boolean(item.details),
        disabled: open || busy,
        why,
        onSelect: () => commander.send(item, "execute"),
      },
      {
        icon: "pulse",
        label: "Status: ask the owner where this stands",
        disabled: open || busy,
        why,
        onSelect: () => commander.send(item, "status"),
      },
    ];
    const taskGroup: ItemAction[] = [
      {
        icon: "check",
        label: "Done",
        disabled: busy,
        onSelect: async () => {
          const fresh = await actions.act(item, "task_done");
          if (fresh && !fresh.items.some((x) => x.ref === item.ref && !x.done))
            onDone?.();
        },
      },
      ...otherBands(item).map((b) => ({
        icon: MOVES[b].icon,
        label: MOVES[b].label,
        disabled: busy,
        onSelect: () => actions.act(item, "task_move", { to: b }),
      })),
    ];
    return (
      <>
        <ItemActions groups={[commanderGroup, taskGroup]} />
        {commander.latest(item.ref) && (
          <div className="dstatus">
            <RequestLine request={commander.latest(item.ref)} now={now} />
          </div>
        )}
      </>
    );
  };

  return (
    <DetailsView
      item={item}
      clientName={clientName}
      details={details}
      githubOrg={config.clients.find((c) => c.key === item.customer)?.githubOrg}
      mondayPrefix={config.trackers.find((t) => t.monday)?.monday?.keyPrefix}
      weekEnd={dayKey(new Date(now.getTime() + 7 * 86400000))}
      now={now}
      openPullRequests={pullCounts(pulls.doc).open}
      draftPullRequests={pullCounts(pulls.doc).draft}
      onClose={onClose}
      actions={detailActions()}
      onAssess={
        item.ref?.startsWith("db:")
          ? () => setAssessOpen(!assessOpen)
          : undefined
      }
      assessOpen={assessOpen}
      assess={
        assessOpen ? (
          <AssessForm
            item={item}
            canSave={runtime.present}
            onCancel={() => setAssessOpen(false)}
            onSave={(change) => {
              setAssessOpen(false);
              planning.assess(item, change).catch(() => undefined);
            }}
          />
        ) : planning.assessNote?.ref === item.ref ? (
          <div className="note" role="status">
            {planning.assessNote?.text}
          </div>
        ) : null
      }
      ask={
        waits ? (
          <CommanderAnswer
            item={waits}
            commander={commander}
            operator={operator}
          />
        ) : null
      }
      pullRequests={
        (item.key || searchable(item) || pulls.doc) && (
          <PullRequests
            doc={pulls.doc}
            copy={pulls.copy}
            trackerKey={item.key}
            searchable={searchable(item)}
            onRefresh={runtime.present ? () => pulls.refresh() : undefined}
            busy={pulls.busy}
            now={now}
          />
        )
      }
    />
  );
}
