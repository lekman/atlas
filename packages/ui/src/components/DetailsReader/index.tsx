import {
  inlineText,
  parseMarkdown,
  type Block,
  type DetailsDocument,
  type Inline,
  type ListBlock,
  type TrackerReference,
} from "@atlas/core";
import type { World } from "@atlas/worlds";
import { useId, useMemo, type ReactNode } from "react";

import { daysBetween, longDay } from "../../dates";

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
          {renderBlocks(blocks, onOpenWikiLink)}
        </div>
        <p className="atlas-details-source">{document.sourcePath}</p>
      </div>
    </article>
  );
}

type WikiHandler = ((target: string) => void) | undefined;

function renderBlocks(
  blocks: readonly Block[],
  onWiki: WikiHandler,
): ReactNode {
  return blocks.map((block, index) => renderBlock(block, index, onWiki));
}

function renderBlock(
  block: Block,
  key: number,
  onWiki: WikiHandler,
): ReactNode {
  switch (block.type) {
    case "heading": {
      // The reader's title is the h2, so the note's own levels start below it.
      const level = Math.min(block.level + 2, 6);
      const Heading = `h${level}` as "h3" | "h4" | "h5" | "h6";
      return (
        <Heading key={key}>{renderInline(block.children, onWiki)}</Heading>
      );
    }
    case "paragraph":
      return <p key={key}>{renderInline(block.children, onWiki)}</p>;
    case "list":
      return renderList(block, key, onWiki);
    case "table":
      return (
        <div
          key={key}
          className="atlas-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Table"
        >
          <table>
            <thead>
              <tr>
                {block.header.map((cell, column) => (
                  <th
                    key={column}
                    scope="col"
                    style={{ textAlign: block.align[column] ?? undefined }}
                  >
                    {renderInline(cell, onWiki)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, column) => (
                    <td
                      key={column}
                      style={{ textAlign: block.align[column] ?? undefined }}
                    >
                      {renderInline(cell, onWiki)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "codeBlock":
      return (
        <pre
          key={key}
          tabIndex={0}
          role="region"
          aria-label={block.language ? `Code, ${block.language}` : "Code"}
        >
          <code>{block.text}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote key={key}>
          {renderBlocks(block.children, onWiki)}
        </blockquote>
      );
    case "callout":
      return (
        <aside
          key={key}
          className="atlas-callout"
          data-kind={calloutTone(block.kind)}
        >
          <p className="atlas-callout-title">
            <span className="atlas-callout-kind">{block.kind}</span>
            {renderInline(block.title, onWiki)}
          </p>
          {renderBlocks(block.children, onWiki)}
        </aside>
      );
    case "rule":
      return <hr key={key} />;
  }
}

/** Callout kinds, folded into the four status hues a reader already knows. */
function calloutTone(kind: string): string {
  if (
    ["warning", "caution", "attention", "question", "help", "faq"].includes(
      kind,
    )
  )
    return "waiting";
  if (["danger", "error", "bug", "failure", "fail", "missing"].includes(kind))
    return "blocked";
  if (["tip", "hint", "important", "success", "check", "done"].includes(kind))
    return "running";
  return "watching";
}

function renderList(
  list: ListBlock,
  key: number,
  onWiki: WikiHandler,
): ReactNode {
  const items = list.items.map((item, index) => (
    <li key={index} data-checked={item.checked}>
      {item.checked !== undefined && (
        <>
          <span className="atlas-check" aria-hidden="true">
            {item.checked ? "✓" : ""}
          </span>
          <span className="atlas-visually-hidden">
            {item.checked ? "Done: " : "Open: "}
          </span>
        </>
      )}
      {renderInline(item.children, onWiki)}
      {item.list && renderList(item.list, 0, onWiki)}
    </li>
  ));
  return list.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
}

function renderInline(
  nodes: readonly Inline[],
  onWiki: WikiHandler,
): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "strong":
        return (
          <strong key={index}>{renderInline(node.children, onWiki)}</strong>
        );
      case "emphasis":
        return <em key={index}>{renderInline(node.children, onWiki)}</em>;
      case "code":
        return <code key={index}>{node.text}</code>;
      case "link":
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {renderInline(node.children, onWiki)}
          </a>
        );
      case "wikiLink":
        return onWiki ? (
          <button
            key={index}
            type="button"
            className="atlas-wiki-link"
            onClick={() => onWiki(node.target)}
          >
            {node.label}
          </button>
        ) : (
          <span key={index} className="atlas-wiki-link">
            {node.label}
          </span>
        );
      case "embed":
        return (
          <span key={index} className="atlas-embed">
            Embedded file: {node.target}
          </span>
        );
    }
  });
}
