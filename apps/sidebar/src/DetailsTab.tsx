import type { Runtime } from "@atlas/runtime";
import { DetailsPlaceholder, SidebarFrame } from "@atlas/ui/sidebar";
import { useEffect } from "react";

import type { SidebarConfig } from "./config";
import { TaskDetails } from "./TaskDetails";
import { useCommander } from "./useCommander";
import { readDetailsIndex } from "./useDetails";
import { useNow } from "./useNow";
import { usePlanning } from "./usePlanning";
import { usePreferences } from "./usePreferences";
import { useStored } from "./useStored";
import { useTaskActions } from "./useTaskActions";
import { useWaiting } from "./useWaiting";
import { useWorklist } from "./useWorklist";

/** The tab's title until the worklist names the task, as the extension names the tab. */
export const UNNAMED_TASK = "Atlas task";

export interface DetailsTabProps {
  runtime: Runtime;
  config: SidebarConfig;
  /** The task the tab shows, by its worklist ref. */
  taskRef: string;
  now?: Date;
}

/**
 * The page in a VS Code editor tab of its own: one task's details at the
 * tab's full width, with no tabs, worklist or Back button. Closing the tab
 * is the way back. It reads the worklist as the sidebar does, so the task
 * appears, and stays current, as the worklist brings it.
 */
export function DetailsTab({
  runtime,
  config,
  taskRef,
  now: fixedNow,
}: DetailsTabProps) {
  const now = useNow(fixedNow);
  const prefs = usePreferences();
  const worklist = useWorklist(runtime, now);
  const detailsIndex = useStored(runtime, "board/details", readDetailsIndex);
  const commander = useCommander(runtime, config.inbox);
  const actions = useTaskActions(runtime, commander, worklist.apply);
  const planning = usePlanning(
    runtime,
    commander,
    worklist.doc?.items ?? null,
    worklist.apply,
  );
  const waiting = useWaiting(runtime);
  const item = worklist.doc?.items.find((t) => t.ref === taskRef) ?? null;
  const title = item?.title ?? UNNAMED_TASK;

  useEffect(() => {
    document.title = title;
  }, [title]);

  const clientName =
    config.clients.find((c) => c.key === item?.customer)?.name ?? "Other";

  return (
    <SidebarFrame fill world={{ id: prefs.world, lighting: prefs.resolved }}>
      {item ? (
        <TaskDetails
          runtime={runtime}
          config={config}
          item={item}
          clientName={clientName}
          now={now}
          commander={commander}
          actions={actions}
          planning={planning}
          waiting={waiting.data?.items ?? []}
          detailsIndex={detailsIndex?.items ?? {}}
        />
      ) : worklist.doc === null && worklist.pending ? (
        <DetailsPlaceholder title="Loading the task">
          Reading the worklist…
        </DetailsPlaceholder>
      ) : (
        <DetailsPlaceholder title="Task not found">
          {worklist.doc
            ? "The worklist does not have this task. This tab shows it as soon as the worklist does."
            : [
                "The worklist could not be read.",
                worklist.error?.text,
                "This tab shows the task as soon as it can.",
              ]
                .filter(Boolean)
                .join(" ")}
        </DetailsPlaceholder>
      )}
    </SidebarFrame>
  );
}
