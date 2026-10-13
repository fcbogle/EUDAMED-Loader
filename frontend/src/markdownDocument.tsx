export type MarkdownContext = {
  sourcePath: string;
  documents: { id: string; sourcePath: string }[];
  onNavigate: (id: string, anchor: string) => void;
};

export function resolveDocumentLink(href: string, context: MarkdownContext): { id: string; anchor: string } | null {
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//")) return null;
  try {
    const target = new URL(href, `https://documentation.local/${context.sourcePath}`);
    const path = decodeURIComponent(target.pathname).slice(1);
    const document = context.documents.find(entry => entry.sourcePath === path);
    return document ? { id: document.id, anchor: decodeURIComponent(target.hash.slice(1)) } : null;
  } catch { return null; }
}

type MarkdownListItem = {
  text: string;
  children: MarkdownListBlock[];
};

type MarkdownListKind = "unordered" | "ordered";

type MarkdownListBlock = {
  kind: MarkdownListKind;
  items: MarkdownListItem[];
};

function renderInlineMarkdown(text: string, context?: MarkdownContext): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const pattern = /\[\[pill:([^\]]+)\]\]|`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^\s)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(
        <span className="markdown-pill" key={`pill-${key++}`}>
          {match[1]}
        </span>,
      );
    } else if (match[2] !== undefined) {
      parts.push(<code key={`code-${key++}`}>{match[2]}</code>);
    } else if (match[3] !== undefined) {
      parts.push(<strong key={`strong-${key++}`}>{renderInlineMarkdown(match[3], context)}</strong>);
    } else if (match[4] !== undefined) {
      const label = match[4];
      const href = match[5];
      const target = context ? resolveDocumentLink(href, context) : null;
      if (target && context) {
        parts.push(<a key={`link-${key++}`} href={`#documentation-${target.id}${target.anchor ? `/${target.anchor}` : ""}`}
          onClick={event => { event.preventDefault(); context.onNavigate(target.id, target.anchor); }}>
          {renderInlineMarkdown(label, context)}</a>);
      } else if (/^(https?:|mailto:)/i.test(href)) {
        parts.push(<a key={`link-${key++}`} href={href} target="_blank" rel="noopener noreferrer">{renderInlineMarkdown(label, context)}</a>);
      } else {
        parts.push(<span key={`reference-${key++}`} title={`Project reference: ${href}`}>{renderInlineMarkdown(label, context)}</span>);
      }
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function parseMarkdownList(
  lines: string[],
  startIndex: number,
  baseIndent: number,
  kind: MarkdownListKind,
): [MarkdownListItem[], number] {
  const items: MarkdownListItem[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      let next = index + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      const nextItem = lines[next]?.match(/^(\s*)(- |\d+\. )(.*)$/);
      // Blank-separated bullets still belong to the same list. An ordinary
      // paragraph after a blank line stays outside the list.
      if (nextItem && nextItem[1].length >= baseIndent) { index = next; continue; }
      break;
    }

    const match = line.match(/^(\s*)(- |\d+\. )(.*)$/);
    if (match) {
      const indent = match[1].length;
      const itemKind: MarkdownListKind = match[2] === "- " ? "unordered" : "ordered";
      if (indent < baseIndent || (indent === baseIndent && itemKind !== kind)) break;
      if (indent > baseIndent) {
        if (!items.length) break;
        const [children, nextIndex] = parseMarkdownList(lines, index, indent, itemKind);
        items[items.length - 1].children.push({kind: itemKind, items: children});
        index = nextIndex;
        continue;
      }
      items.push({text: match[3], children: []});
      index++;
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (!items.length || (baseIndent > 0 && indent <= baseIndent) ||
        /^(#|```)/.test(trimmed) || startsTable(lines, index)) break;
    items[items.length - 1].text += ` ${trimmed}`;
    index++;
  }

  return [items, index];
}

function renderMarkdownList(items: MarkdownListItem[], keyPrefix: string, kind: MarkdownListKind, context?: MarkdownContext): JSX.Element {
  const Tag = kind === "ordered" ? "ol" : "ul";
  return (
    <Tag key={keyPrefix}>
      {items.map((item, itemIndex) => (
        <li key={`${keyPrefix}-item-${itemIndex}`}>
          {renderInlineMarkdown(item.text, context)}
          {item.children.map((childBlock, childIndex) =>
            renderMarkdownList(
              childBlock.items,
              `${keyPrefix}-nested-${itemIndex}-${childIndex}`,
              childBlock.kind,
              context,
            ),
          )}
        </li>
      ))}
    </Tag>
  );
}

function tableCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let code = false;
  const row = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  for (let index = 0; index < row.length; index++) {
    if (row[index] === "\\" && row[index + 1] === "|") { cell += "|"; index++; continue; }
    if (row[index] === "`") code = !code;
    if (row[index] === "|" && !code) { cells.push(cell.trim()); cell = ""; }
    else cell += row[index];
  }
  cells.push(cell.trim());
  return cells;
}

function startsTable(lines: string[], index: number): boolean {
  if (!lines[index]?.includes("|") || !lines[index + 1]) return false;
  const headers = tableCells(lines[index]);
  const separators = tableCells(lines[index + 1]);
  return headers.length > 1 && headers.length === separators.length && separators.every(cell => /^:?-{3,}:?$/.test(cell));
}

export function renderMarkdownDocument(content: string, context?: MarkdownContext): JSX.Element[] {
  const lines = content.split("\n");
  const blocks: JSX.Element[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre className="markdown-code-block" key={`block-${key++}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (trimmed.startsWith("#")) {
      const level = Math.min(trimmed.match(/^#+/)?.[0].length ?? 1, 3);
      const text = trimmed.replace(/^#+\s*/, "");
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      blocks.push(
        <Tag key={`block-${key++}`} id={id}>
          {renderInlineMarkdown(text, context)}
        </Tag>,
      );
      index += 1;
      continue;
    }

    if (startsTable(lines, index)) {
      const headers = tableCells(line);
      const alignment = tableCells(lines[index + 1]).map(cell => cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : "left");
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        rows.push(tableCells(lines[index++]));
      }
      blocks.push(<div className="markdown-table-shell" key={`block-${key++}`} tabIndex={0} aria-label="Documentation table">
        <table><thead><tr>{headers.map((header, column) => <th scope="col" key={column} style={{textAlign: alignment[column] as "left" | "center" | "right"}}>
          {renderInlineMarkdown(header, context)}</th>)}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, column) => <td key={column} style={{textAlign: alignment[column] as "left" | "center" | "right"}}>
            {renderInlineMarkdown(row[column] ?? "", context)}</td>)}</tr>)}</tbody>
        </table></div>);
      continue;
    }

    if (/^\s*(- |\d+\. )/.test(line)) {
      const kind: MarkdownListKind = /^\s*\d+\. /.test(line) ? "ordered" : "unordered";
      const baseIndent =
        (kind === "ordered" ? line.match(/^(\s*)\d+\. /) : line.match(/^(\s*)- /))?.[1].length ?? 0;
      const [items, nextIndex] = parseMarkdownList(lines, index, baseIndent, kind);
      blocks.push(renderMarkdownList(items, `block-${key++}`, kind, context));
      index = nextIndex;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("#") &&
      !lines[index].trim().startsWith("- ") &&
      !/^\d+\. /.test(lines[index].trim()) &&
      !lines[index].trim().startsWith("```") &&
      !startsTable(lines, index)
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`block-${key++}`}>{renderInlineMarkdown(paragraphLines.join(" "), context)}</p>);
  }

  return blocks;
}
