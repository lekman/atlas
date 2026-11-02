import {
  inlineText,
  parseMarkdown,
  type DetailsDocument,
  type TrackerReference,
} from "@atlas/core";
import type { World } from "@atlas/worlds";
import { useId, useMemo } from "react";

import { daysBetween, longDay } from "../../dates";
import { MarkdownBlocks } from "../../markdown/MarkdownBlocks";

export interface DetailsReaderProps {
  /** The document to read. */
  document: DetailsDocument;
  /** The world it is framed in: a tight-beam transmission for the Astronomer, a reading panel elsewhere. */
  world: World;
  /** Who the document is about, shown as where it came from. */
  clientName: string;
  /** The day it is read on, to say how fresh the document is. */
  today: string;
  /** The task's tracker reference. Without one there is no Open ticket button. */
  tracker?: TrackerReference;
  /** Close was pressed. */
  onClose(): void;
  /** Open in Obsidian was pressed, with the document's path in the vault. */
  onOpenInObsidian(sourcePath: string): void;
  /** Open ticket was pressed, with the tracker's address. */
  onOpenTicket(url: string): void;
  /** A wiki-link was picked. Without this, wiki-links read as plain text. */
  onOpenWikiLink?(target: string): void;
}

/** Strength out of five, from how many days ago the note last changed. */
function signalStrength(age: number): number {
  if (age <= 0) return 5;
  if (age === 1) return 4;
  if (age <= 3) return 3;
  if (age <= 7) return 2;
  return 1;
}

function ageText(age: number): string {
  if (age <= 0) return "updated today";
  if (age === 1) return "updated yesterday";
  return `updated ${age} days ago`;
}

/**
 * A details document, read in the app rather than in the vault.
 *
 * The Markdown goes through `parseMarkdown` and is drawn as React elements,
 * so raw HTML in a note is shown as text and never run. The text column is
 * held to about 68 characters, and the text stays selectable.
 *
 * In the Astronomer it arrives as a tight-beam transmission: origin, relay
 * and signal lines in the mono face, and the text decoding in, top to
 * bottom, when it opens. The signal is real: it is how recently the note
 * changed. Under `prefers-reduced-motion` the text simply shows. Every
 * other world gets a plain reading panel until its own frame is designed.
 * The real word, "Details", is always under the title, and the buttons
 * keep plain words.
 */
export function DetailsReader({
  document,
  world,
  clientName,
  today,
  tracker,
  onClose,
  onOpenInObsidian,
  onOpenTicket,
  onOpenWikiLink,
}: DetailsReaderProps) {
  const titleId = useId();
  const blocks = useMemo(() => {
    const parsed = parseMarkdown(document.markdown);
    // A note usually opens with its own title, which the header already shows.
    const [first, ...rest] = parsed;
    return first?.type === "heading" &&
      inlineText(first.children).trim() === document.title.trim()
      ? rest
      : parsed;
  }, [document.markdown, document.title]);
  const transmission = world.id === "astronomer";
  const age = daysBetween(document.updatedOn, today);
  const strength = signalStrength(age);

  return (
    <article
      className="atlas-details"
      data-frame={transmission ? "transmission" : "panel"}
      aria-labelledby={titleId}
    >
      <header className="atlas-details-header">
        {transmission ? (
          <>
            <p className="atlas-eyebrow">Tight-beam transmission</p>
            <dl className="atlas-transmission">
              <div>
                <dt>Origin</dt>
                <dd>{clientName}</dd>
              </div>
              <div>
                <dt>Relay</dt>
                <dd>Obsidian Sync · Mac mini</dd>
              </div>
              <div>
                <dt>Signal</dt>
                <dd>
                  <span
                    className="atlas-signal"
                    role="img"
                    aria-label={`Signal ${strength} of 5`}
                  >
                    {[1, 2, 3, 4, 5].map((bar) => (
                      <span key={bar} data-lit={bar <= strength} />
                    ))}
                  </span>{" "}
                  {ageText(age)}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="atlas-eyebrow">{clientName}</p>
        )}
        <h2 id={titleId}>{document.title}</h2>
        <p className="atlas-real-term">
          Details · {transmission ? "" : `${ageText(age)} · `}
          {longDay(document.updatedOn)}
        </p>
        <div className="atlas-actions">
          <button
            type="button"
            className="atlas-button"
            onClick={() => onOpenInObsidian(document.sourcePath)}
          >
            Open in Obsidian
          </button>
          {tracker && (
            <button
              type="button"
              className="atlas-button"
              onClick={() => onOpenTicket(tracker.url)}
            >
              Open ticket
            </button>
          )}
          <button type="button" className="atlas-button" onClick={onClose}>
            Close
          </button>
        </div>
      </header>
      <div
        className="atlas-details-body"
        // A scrolling region has to be reachable from the keyboard.
        tabIndex={0}
        role="region"
        aria-label={`${document.title}, text`}
      >
        <div className="atlas-prose">
          <MarkdownBlocks blocks={blocks} onWikiLink={onOpenWikiLink} />
        </div>
        <p className="atlas-details-source">{document.sourcePath}</p>
      </div>
    </article>
  );
}
