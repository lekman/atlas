import type { Runtime } from "@atlas/runtime";
import { mondayPage, type MondayPage } from "@atlas/ui/sidebar";
import { useMemo } from "react";

import type { MondayBoard } from "./config";
import { useFeed, type Feed } from "./useFeed";

const OFF: Feed<MondayPage> & { updatedAt: null } = {
  data: null,
  live: false,
  error: null,
  failure: null,
  updatedAt: null,
};

/**
 * The operator's items on a Monday board that aren't Done, through the
 * monday.com connector every five minutes. Nothing is stored: a device
 * without the connector shows why instead, as the previous page did.
 */
export function useMonday(
  runtime: Runtime,
  board: MondayBoard | undefined,
): Feed<MondayPage> & { updatedAt: Date | null } {
  const feed = useFeed<MondayPage>(
    runtime,
    board
      ? {
          server: "monday.com",
          tool: "get_board_items_page",
          args: {
            boardId: board.boardId,
            includeColumns: true,
            limit: 100,
            columnIds: [
              board.columns.status,
              board.columns.priority,
              board.columns.timeline,
              board.columns.key,
            ].filter(Boolean),
            filters: [
              {
                columnId: board.personColumn,
                compareValue: [board.personId],
                operator: "any_of",
              },
              {
                columnId: board.columns.status,
                compareValue: [board.doneIndex ?? 1],
                operator: "not_any_of",
              },
            ],
          },
          accept: (d) => mondayPage(d, board.columns, board.keyPrefix),
          watch: {
            refetchInterval: 5 * 60000,
            cache: { staleTime: 60000, gcTime: 6 * 3600000 },
          },
        }
      : null,
    "monday.com",
  );
  const liveAt = feed.liveAt;
  const updatedAt = useMemo(() => (liveAt ? new Date(liveAt) : null), [liveAt]);
  return board ? { ...feed, updatedAt } : OFF;
}
