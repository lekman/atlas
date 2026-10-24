import { needsYou, type Dataset } from "@atlas/core";
import type { World } from "@atlas/worlds";
import type { ReactNode } from "react";

export interface NeedsYouListProps {
  /** Where questions and agents are read from. */
  dataset: Dataset;
  /** Whose words name each entry. */
  world: World;
  /** An entry was picked, to open in the inspector. */
  onSelect(id: string): void;
  /** The entry shown expanded, in place of its one-line button. */
  selectedId?: string | null;
  /** What the expanded entry shows: the record and what can be done with it. */
  selected?: ReactNode;
}

/**
 * What needs the reader, first: questions only they can answer, then agents
 * waiting, blocked or failed. One entry at a time can open in place, as an
 * accordion: the others stay one line each, so the list keeps its shape.
 */
export function NeedsYouList({
  dataset,
  world,
  onSelect,
  selectedId = null,
  selected,
}: NeedsYouListProps) {
  const entries = needsYou(dataset);
  const clientName = (id: string) => {
    const client = dataset.clients.find((candidate) => candidate.id === id);
    return client?.home ? world.vocabulary.homeName : (client?.name ?? id);
  };
  return (
    <section className="atlas-section" aria-labelledby="atlas-needs-you">
      <h2 className="atlas-section-title" id="atlas-needs-you">
        <span>Needs you</span>
        <span>{entries.length}</span>
      </h2>
      {entries.length === 0 ? (
        <p className="atlas-empty">Nothing is waiting on you.</p>
      ) : (
        <ul className="atlas-needs">
          {entries.map((entry) =>
            entry.id === selectedId && selected ? (
              <li key={entry.id} data-selected="true">
                {selected}
              </li>
            ) : (
              <li key={entry.id}>
                <button
                  type="button"
                  className="atlas-need"
                  onClick={() => onSelect(entry.id)}
                >
                  <span
                    className="atlas-dot"
                    style={{ background: `var(--atlas-${entry.status})` }}
                    aria-hidden="true"
                  />
                  <span className="atlas-need-text">
                    <strong>{entry.title}</strong>
                    <span>
                      {clientName(entry.clientId)} · {entry.detail}
                    </span>
                  </span>
                  <span className="atlas-tag">
                    {entry.kind === "question"
                      ? world.vocabulary.question
                      : world.statusNames[entry.status]}
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
