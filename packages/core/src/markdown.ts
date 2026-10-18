/**
 * A safe Markdown parser for details documents.
 *
 * It produces a small tree that a screen renders as its own elements, so
 * no HTML is ever produced or passed through: raw HTML in a note, a
 * `<script>` included, stays text. Only the subset a details note needs is
 * read: headings, paragraphs, lists one level deep, tables, fenced code,
 * block quotes and Obsidian callouts, with bold, italic, code, links and
 * wiki-links inline. Anything else reads as the text it is.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "emphasis"; children: Inline[] }
  | { type: "code"; text: string }
  /** A link with a safe address: http, https, mailto or obsidian. */
  | { type: "link"; href: string; children: Inline[] }
  /** `[[Target]]` or `[[Target|label]]`: a note in the vault. */
  | { type: "wikiLink"; target: string; label: string }
  /** `![[file]]` or `![alt](address)`: listed, never drawn. */
  | { type: "embed"; target: string };

export interface ListItem {
  children: Inline[];
  /** For a task list item, whether it is ticked. */
  checked?: boolean;
  /** One level of nesting. */
  list?: ListBlock;
}

export interface ListBlock {
  type: "list";
  ordered: boolean;
  items: ListItem[];
}

export type Alignment = "left" | "center" | "right" | null;

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | ListBlock
  | {
      type: "table";
      align: Alignment[];
      header: Inline[][];
      rows: Inline[][][];
    }
  | { type: "codeBlock"; language: string | null; text: string }
  | { type: "quote"; children: Block[] }
  /** `> [!note] Title`: an Obsidian callout of a kind, with a title. */
  | { type: "callout"; kind: string; title: Inline[]; children: Block[] }
  | { type: "rule" };

const safeSchemes = /^(https?:|mailto:|obsidian:)/i;

/** Whether an address is one a reader may follow. Anything else stays text. */
export function isSafeHref(href: string): boolean {
  return safeSchemes.test(href.trim());
}

const fence = /^(\s*)(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const rule = /^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/;
const listItem = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const tableSeparator = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const calloutStart = /^\[!([A-Za-z-]+)\][+-]?\s*(.*)$/;

/** Parses a note into blocks. Never throws: what it cannot read stays text. */
export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return parseBlocks(stripFrontMatter(lines), 0);
}

function stripFrontMatter(lines: string[]): string[] {
  if (lines[0]?.trim() !== "---") return lines;
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  return end === -1 ? lines : lines.slice(end + 1);
}

/** Quotes inside quotes are read as quotes, up to this depth, then as text. */
const deepestQuote = 4;

function parseBlocks(lines: string[], depth: number): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  const at = (offset = 0) => lines[index + offset];

  while (index < lines.length) {
    const line = at() ?? "";
    if (line.trim() === "") {
      index++;
      continue;
    }

    const fenced = fence.exec(line);
    if (fenced) {
      const marker = fenced[2] ?? "```";
      const body: string[] = [];
      index++;
      while (index < lines.length && !(at() ?? "").trim().startsWith(marker)) {
        body.push(at() ?? "");
        index++;
      }
      index++; // the closing fence, or the end of the note
      blocks.push({
        type: "codeBlock",
        language: fenced[3] ? fenced[3] : null,
        text: body.join("\n"),
      });
      continue;
    }

    const titled = heading.exec(line);
    if (titled) {
      blocks.push({
        type: "heading",
        level: (titled[1] ?? "#").length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(titled[2] ?? ""),
      });
      index++;
      continue;
    }

    if (rule.test(line)) {
      blocks.push({ type: "rule" });
      index++;
      continue;
    }

    if (line.trimStart().startsWith(">") && depth < deepestQuote) {
      const quoted: string[] = [];
      while (index < lines.length && (at() ?? "").trimStart().startsWith(">")) {
        quoted.push((at() ?? "").trimStart().replace(/^> ?/, ""));
        index++;
      }
      const callout = calloutStart.exec(quoted[0] ?? "");
      if (callout) {
        const kind = (callout[1] ?? "note").toLowerCase();
        blocks.push({
          type: "callout",
          kind,
          title: parseInline(callout[2] || capitalise(kind)),
          children: parseBlocks(quoted.slice(1), depth + 1),
        });
      } else {
        blocks.push({
          type: "quote",
          children: parseBlocks(quoted, depth + 1),
        });
      }
      continue;
    }

    if (line.includes("|") && tableSeparator.test(at(1) ?? "")) {
      const header = splitRow(line);
      const align = splitRow(at(1) ?? "").map(alignmentOf);
      index += 2;
      const rows: Inline[][][] = [];
      while (index < lines.length) {
        const row = at() ?? "";
        if (row.trim() === "" || !row.includes("|")) break;
        const cells = splitRow(row);
        rows.push(header.map((_, column) => parseInline(cells[column] ?? "")));
        index++;
      }
      blocks.push({
        type: "table",
        align: header.map((_, column) => align[column] ?? null),
        header: header.map((cell) => parseInline(cell)),
        rows,
      });
      continue;
    }

    if (listItem.test(line)) {
      const { list, next } = parseList(lines, index);
      blocks.push(list);
      index = next;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const next = at() ?? "";
      if (paragraph.length > 0 && startsBlock(next, at(1))) break;
      if (next.trim() === "") break;
      paragraph.push(next.trim());
      index++;
    }
    blocks.push({
      type: "paragraph",
      children: parseInline(paragraph.join(" ")),
    });
  }
  return blocks;
}

function startsBlock(line: string, following: string | undefined): boolean {
  return (
    fence.test(line) ||
    heading.test(line) ||
    rule.test(line) ||
    line.trimStart().startsWith(">") ||
    listItem.test(line) ||
    (line.includes("|") && tableSeparator.test(following ?? ""))
  );
}

function indentOf(text: string): number {
  return text.replace(/\t/g, "    ").length;
}

function parseList(
  lines: string[],
  start: number,
): { list: ListBlock; next: number } {
  const first = listItem.exec(lines[start] ?? "");
  const baseIndent = indentOf(first?.[1] ?? "");
  const ordered = /\d/.test(first?.[2] ?? "");
  const items: ListItem[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      // A blank line ends the list unless the next line carries on with it.
      const following = listItem.exec(lines[index + 1] ?? "");
      if (following && indentOf(following[1] ?? "") >= baseIndent) {
        index++;
        continue;
      }
      break;
    }
    const match = listItem.exec(line);
    if (!match) {
      // A wrapped line belongs to the item above it.
      const last = items.at(-1);
      if (!last || startsBlock(line, lines[index + 1])) break;
      last.children.push(
        { type: "text", text: " " },
        ...parseInline(line.trim()),
      );
      index++;
      continue;
    }
    const indent = indentOf(match[1] ?? "");
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      const parent = items.at(-1);
      if (!parent) break;
      // One level of nesting; anything deeper joins that level.
      const nested: ListItem[] = parent.list?.items ?? [];
      const nestedOrdered = /\d/.test(match[2] ?? "");
      nested.push(itemFrom(match[3] ?? ""));
      parent.list = parent.list ?? {
        type: "list",
        ordered: nestedOrdered,
        items: nested,
      };
      index++;
      continue;
    }
    items.push(itemFrom(match[3] ?? ""));
    index++;
  }
  return { list: { type: "list", ordered, items }, next: index };
}

function itemFrom(text: string): ListItem {
  const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
  if (task) {
    return {
      checked: task[1] !== " ",
      children: parseInline(task[2] ?? ""),
    };
  }
  return { children: parseInline(text) };
}

function splitRow(row: string): string[] {
  let trimmed = row.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|") && !trimmed.endsWith("\\|"))
    trimmed = trimmed.slice(0, -1);
  return trimmed
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function alignmentOf(cell: string): Alignment {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Parses one line of inline Markdown. Unmatched markers stay as text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };
  let index = 0;

  while (index < text.length) {
    const rest = text.slice(index);
    const character = text[index] ?? "";

    if (
      character === "\\" &&
      index + 1 < text.length &&
      /[\\`*_[\]!|#>]/.test(text[index + 1] ?? "")
    ) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }

    if (character === "`") {
      const close = text.indexOf("`", index + 1);
      if (close > index + 1) {
        flush();
        out.push({ type: "code", text: text.slice(index + 1, close) });
        index = close + 1;
        continue;
      }
    }

    if (rest.startsWith("![[")) {
      const close = text.indexOf("]]", index + 3);
      if (close !== -1) {
        flush();
        out.push({
          type: "embed",
          target: text.slice(index + 3, close).trim(),
        });
        index = close + 2;
        continue;
      }
    }

    if (rest.startsWith("[[")) {
      const close = text.indexOf("]]", index + 2);
      if (close !== -1) {
        const inner = text.slice(index + 2, close);
        const [target = "", label] = inner.split("|");
        flush();
        out.push({
          type: "wikiLink",
          target: target.trim(),
          label: (label ?? target.split("#")[0] ?? target).trim(),
        });
        index = close + 2;
        continue;
      }
    }

    if (character === "!" && text[index + 1] === "[") {
      const link = readLink(text, index + 1);
      if (link) {
        flush();
        out.push({ type: "embed", target: link.label || link.href });
        index = link.end;
        continue;
      }
    }

    if (character === "[") {
      const link = readLink(text, index);
      if (link) {
        flush();
        if (isSafeHref(link.href)) {
          out.push({
            type: "link",
            href: link.href.trim(),
            children: parseInline(link.label),
          });
        } else {
          // An address that is not safe to follow: its words stay, it does not.
          out.push(...parseInline(link.label));
        }
        index = link.end;
        continue;
      }
    }

    if (rest.startsWith("**") || rest.startsWith("__")) {
      const marker = rest.slice(0, 2);
      const close = text.indexOf(marker, index + 2);
      if (close > index + 2) {
        flush();
        out.push({
          type: "strong",
          children: parseInline(text.slice(index + 2, close)),
        });
        index = close + 2;
        continue;
      }
    }

    if (
      character === "*" ||
      (character === "_" && !/\w/.test(text[index - 1] ?? ""))
    ) {
      const close = findEmphasisClose(text, index + 1, character);
      if (close > index + 1) {
        flush();
        out.push({
          type: "emphasis",
          children: parseInline(text.slice(index + 1, close)),
        });
        index = close + 1;
        continue;
      }
    }

    buffer += character;
    index++;
  }
  flush();
  return out;
}

function findEmphasisClose(text: string, from: number, marker: string): number {
  if (/\s/.test(text[from] ?? " ")) return -1;
  for (let index = from; index < text.length; index++) {
    if (text[index] !== marker) continue;
    if (text[index + 1] === marker) {
      index++;
      continue;
    }
    if (/\s/.test(text[index - 1] ?? " ")) continue;
    if (marker === "_" && /\w/.test(text[index + 1] ?? "")) continue;
    return index;
  }
  return -1;
}

function readLink(
  text: string,
  open: number,
): { label: string; href: string; end: number } | null {
  let depth = 0;
  let close = -1;
  for (let index = open; index < text.length; index++) {
    if (text[index] === "[") depth++;
    if (text[index] === "]") {
      depth--;
      if (depth === 0) {
        close = index;
        break;
      }
    }
  }
  if (close === -1 || text[close + 1] !== "(") return null;
  const end = text.indexOf(")", close + 2);
  if (end === -1) return null;
  const href =
    text
      .slice(close + 2, end)
      .trim()
      .split(/\s+/)[0] ?? "";
  return { label: text.slice(open + 1, close), href, end: end + 1 };
}

/** The plain words of inline content, for accessible names and search. */
export function inlineText(nodes: readonly Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code":
          return node.text;
        case "wikiLink":
          return node.label;
        case "embed":
          return node.target;
        default:
          return inlineText(node.children);
      }
    })
    .join("");
}
