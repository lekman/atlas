import {
  bands,
  type Band,
  type Client,
  type ImportReport as ImportReportRecord,
} from "@atlas/core";
import { useId } from "react";

import { longDay } from "../../dates";

export interface ImportReportProps {
  /** What the dry run found. */
  report: ImportReportRecord;
  /** Who the work is for, to name each row. Home comes first. */
  clients: Client[];
  /** Import was pressed. The parent runs the import; the report only asks for it. */
  onImport(): void;
}

const bandTitles: Record<Band, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  future: "Future",
  unscheduled: "Unscheduled",
};

function listNumbers(numbers: readonly number[]): string {
  if (numbers.length <= 1) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}`;
}

/**
 * The dry run of a dashboard import, read before anything is written: how
 * many tasks land with each client in each band, the lines it could not
 * place and why, the lines held back because they look like credentials,
 * and the tasks still waiting for a size.
 *
 * A held-back line is named by its number only. Its text never reaches
 * this screen, so a credential cannot be shown, logged or screenshotted.
 */
export function ImportReport({ report, clients, onImport }: ImportReportProps) {
  const titleId = useId();
  const ordered = [
    ...clients.filter((client) => client.home === true),
    ...clients.filter((client) => client.home !== true),
  ].filter((client) =>
    report.counts.some((count) => count.clientId === client.id),
  );
  const count = (clientId: string, band: Band) =>
    report.counts
      .filter((entry) => entry.clientId === clientId && entry.band === band)
      .reduce((sum, entry) => sum + entry.tasks, 0);
  const bandTotal = (band: Band) =>
    report.counts
      .filter((entry) => entry.band === band)
      .reduce((sum, entry) => sum + entry.tasks, 0);
  const total = report.counts.reduce((sum, entry) => sum + entry.tasks, 0);
  const clientName = (id: string) =>
    clients.find((client) => client.id === id)?.name ?? id;
  const lines = (amount: number) => (amount === 1 ? "line" : "lines");

  return (
    <section className="atlas-import-report" aria-labelledby={titleId}>
      <p className="atlas-eyebrow">Dry run · nothing written yet</p>
      <h2 id={titleId}>Import report</h2>
      <p className="atlas-real-term">
        {report.sourcePath} · read {longDay(report.readOn)}
      </p>
      <p className="atlas-import-summary">
        <strong>{total} tasks</strong> for {ordered.length} clients ·{" "}
        {report.unplaced.length} {lines(report.unplaced.length)} not placed ·{" "}
        {report.heldBack.length} held back · {report.waitingForSize.length}{" "}
        waiting for a size
      </p>

      <div
        className="atlas-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Tasks by client and day"
      >
        <table className="atlas-counts">
          <thead>
            <tr>
              <th scope="col">Client</th>
              {bands.map((band) => (
                <th scope="col" key={band}>
                  {bandTitles[band]}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((client) => (
              <tr key={client.id}>
                <th scope="row">{client.name}</th>
                {bands.map((band) => (
                  <td key={band}>{count(client.id, band) || "–"}</td>
                ))}
                <td>
                  {bands.reduce((sum, band) => sum + count(client.id, band), 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">All</th>
              {bands.map((band) => (
                <td key={band}>{bandTotal(band)}</td>
              ))}
              <td>{total}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h3 className="atlas-section-title">Not placed</h3>
      {report.unplaced.length === 0 ? (
        <p className="atlas-empty">Every line found its place.</p>
      ) : (
        <ul className="atlas-unplaced">
          {report.unplaced.map((entry) => (
            <li key={entry.line}>
              <span className="atlas-line-number">Line {entry.line}</span>
              <span>{entry.reason}</span>
              <code>{entry.excerpt}</code>
            </li>
          ))}
        </ul>
      )}

      <h3 className="atlas-section-title">Held back</h3>
      {report.heldBack.length === 0 ? (
        <p className="atlas-empty">Nothing looked like a credential.</p>
      ) : (
        <p className="atlas-held-back">
          {report.heldBack.length === 1 ? "Line" : "Lines"}{" "}
          <strong>{listNumbers(report.heldBack)}</strong>{" "}
          {report.heldBack.length === 1
            ? "looks like a credential. Its text is not shown and will not be imported. Remove it"
            : "look like credentials. Their text is not shown and will not be imported. Remove them"}{" "}
          from the dashboard, then run the dry run again.
        </p>
      )}

      <h3 className="atlas-section-title">Waiting for a size</h3>
      {report.waitingForSize.length === 0 ? (
        <p className="atlas-empty">Every task has an effort and a value.</p>
      ) : (
        <>
          <ul className="atlas-waiting-size">
            {report.waitingForSize.map((entry) => (
              <li key={`${entry.clientId}-${entry.title}`}>
                {entry.title}{" "}
                <span className="atlas-mute">
                  · {clientName(entry.clientId)}
                </span>
              </li>
            ))}
          </ul>
          <p className="atlas-mute">
            They keep their old marker until they are sized.
          </p>
        </>
      )}

      <div className="atlas-actions">
        <button
          type="button"
          className="atlas-button atlas-button-primary"
          onClick={onImport}
        >
          Import
        </button>
      </div>
    </section>
  );
}
