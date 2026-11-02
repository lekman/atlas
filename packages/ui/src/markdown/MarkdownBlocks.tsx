/**
 * Draws a parsed note (see `parseMarkdown` in `@atlas/core`) as React
 * elements. Nothing is ever set as HTML: a note's text, raw HTML and
 * scripts included, stays text, and only links `isSafeHref` passed are
 * links. The full-page reader and the sidebar's details both use it.
 */
import type { Block, Inline, ListBlock } from "@atlas/core/markdown";
import type { ReactNode } from "react";

export interface MarkdownBlocksProps {
  blocks: readonly Block[];
  /** A wiki-link was picked. Without this, wiki-links read as plain text. */
  onWikiLink?: (target: string) => void;
  /** Which of the parser's safe links stay links; the rest read as their text. */
  allowLink?: (href: string) => boolean;
}

/** The note's blocks. Its headings start at h3, under the reader's own h2 title. */
export function MarkdownBlocks({
  blocks,
  onWikiLink,
  allowLink,
}: MarkdownBlocksProps) {
  return (
    <>
      {renderBlocks(blocks, {
        onWiki: onWikiLink,
        allow: allowLink ?? (() => true),
      })}
    </>
  );
}

interface Context {
  onWiki: ((target: string) => void) | undefined;
  allow: (href: string) => boolean;
}

function renderBlocks(blocks: readonly Block[], ctx: Context): ReactNode {
  return blocks.map((block, index) => renderBlock(block, index, ctx));
}

function renderBlock(block: Block, key: number, ctx: Context): ReactNode {
  switch (block.type) {
    case "heading": {
      // The reader's title is the h2, so the note's own levels start below it.
      const level = Math.min(block.level + 2, 6);
      const Heading = `h${level}` as "h3" | "h4" | "h5" | "h6";
      return <Heading key={key}>{renderInline(block.children, ctx)}</Heading>;
    }
    case "paragraph":
      return <p key={key}>{renderInline(block.children, ctx)}</p>;
    case "list":
      return renderList(block, key, ctx);
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
                    {renderInline(cell, ctx)}
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
                      {renderInline(cell, ctx)}
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
        <blockquote key={key}>{renderBlocks(block.children, ctx)}</blockquote>
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
            {renderInline(block.title, ctx)}
          </p>
          {renderBlocks(block.children, ctx)}
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

function renderList(list: ListBlock, key: number, ctx: Context): ReactNode {
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
      {renderInline(item.children, ctx)}
      {item.list && renderList(item.list, 0, ctx)}
    </li>
  ));
  return list.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
}

function renderInline(nodes: readonly Inline[], ctx: Context): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "strong":
        return <strong key={index}>{renderInline(node.children, ctx)}</strong>;
      case "emphasis":
        return <em key={index}>{renderInline(node.children, ctx)}</em>;
      case "code":
        return <code key={index}>{node.text}</code>;
      case "link":
        if (!ctx.allow(node.href)) {
          return <span key={index}>{renderInline(node.children, ctx)}</span>;
        }
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {renderInline(node.children, ctx)}
          </a>
        );
      case "wikiLink":
        return ctx.onWiki ? (
          <button
            key={index}
            type="button"
            className="atlas-wiki-link"
            onClick={() => ctx.onWiki?.(node.target)}
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
