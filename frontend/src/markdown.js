// A tiny, safe formatter for chat replies: paragraphs, "- " bullets, numbered lines, **bold** and `code`.
// It returns plain data (no HTML), so a reply can never inject markup into the page.

const BULLET = /^\s*(?:[-*\u2022])\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

export function parseBlocks(text = "") {
  const blocks = [];
  let list = null;
  let table = null;
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  const flushTable = () => {
    if (table && table.rows.length + (table.header ? 1 : 0) > 0) blocks.push(table);
    table = null;
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (TABLE_ROW.test(line)) {
      flushList();
      if (!table) table = { type: "table", header: null, rows: [] };
      if (TABLE_RULE.test(line)) continue;
      const cells = splitRow(line);
      if (!table.header && table.rows.length === 0) table.header = cells;
      else table.rows.push(cells);
      continue;
    }
    flushTable();
    if (!line.trim()) {
      flushList();
      continue;
    }
    const bullet = line.match(BULLET);
    const numbered = bullet ? null : line.match(NUMBERED);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet || numbered)[1]);
      continue;
    }
    flushList();
    const last = blocks[blocks.length - 1];
    if (last && last.type === "p" && last.openParagraph) {
      last.text += ` ${line.trim()}`;
    } else {
      blocks.push({ type: "p", text: line.trim(), openParagraph: true });
    }
  }
  flushList();
  flushTable();
  // A blank line ends a paragraph; lines inside one paragraph were already joined above.
  return blocks.map(({ openParagraph, ...block }) => block);
}

// Splits a line into plain, bold and code pieces. An unfinished marker (while a reply is still
// streaming) stays as plain text instead of flashing as broken formatting.
export function parseInline(text = "") {
  const parts = [];
  // bold | code | [label](https://link) | a bare https:// link
  const pattern = /\*\*([^*]+?)\*\*|`([^`]+?)`|\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)<>\]]+)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    let end = match.index + match[0].length;
    let part;
    if (match[1] !== undefined) part = { type: "bold", value: match[1] };
    else if (match[2] !== undefined) part = { type: "code", value: match[2] };
    else if (match[4] !== undefined) part = { type: "link", value: match[3], href: match[4] };
    else {
      // A sentence-ending full stop or comma is not part of the address.
      const url = match[5].replace(/[.,;:!?]+$/, "");
      end -= match[5].length - url.length;
      part = { type: "link", value: url, href: url };
    }
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    parts.push(part);
    last = end;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

// The same reply without formatting marks, for "Copy answer".
export function plainText(text = "") {
  return text
    .replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, "")
    .replace(/^\s*\|(.*)\|\s*$/gm, (_, row) => row.split("|").map((cell) => cell.trim()).join("  |  "))
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/^\s*[-*\u2022]\s+/gm, "• ");
}

// ---- chips, highlighted numbers and the typing reveal --------------------------------------------

// A bullet list of short names (3 or more, each a few words, no sentence punctuation) is shown as chips.
export function chipItems(items) {
  if (!Array.isArray(items) || items.length < 3 || items.length > 14) return false;
  return items.every((item) => {
    const plain = item.replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
    return plain.length > 0 && plain.length <= 34 && plain.split(/\s+/).length <= 5 && !/[.:;!?]/.test(plain);
  });
}

const STAT = /\b\d{1,3}(?:[.,]\d+)?\s?[-–]\s?\d{1,3}(?:[.,]\d+)?\s?%|\b\d{1,3}(?:[.,]\d+)?\+?\s?%|\b\d+(?:\.\d+)?\+?\s?(?:years?|yrs?|months?)\b|\b\d{1,3}\s?[-–]\s?\d{1,3}\s?(?:applications?|apps?|systems?)\b/gi;

// Splits plain text into pieces, marking figures such as "3+ years", "30-40%" or "5-7 applications".
export function splitStats(text = "") {
  const pieces = [];
  let last = 0;
  for (const match of text.matchAll(STAT)) {
    if (match.index > last) pieces.push({ value: text.slice(last, match.index), stat: false });
    pieces.push({ value: match[0], stat: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ value: text.slice(last), stat: false });
  return pieces.length ? pieces : [{ value: text, stat: false }];
}

// The first `count` characters of a reply for the typing effect: it stops at a word boundary and closes any
// bold or code mark left open, so half-typed text never shows stray ** or backticks.
export function revealSlice(text = "", count = 0) {
  if (count >= text.length) return text;
  let cut = Math.max(0, count);
  while (cut > 0 && cut < text.length && !/\s/.test(text[cut]) && !/\s/.test(text[cut - 1])) cut -= 1;
  let shown = text.slice(0, cut).replace(/\s+$/, "");
  if ((shown.match(/\*\*/g) || []).length % 2 === 1) shown += "**";
  if ((shown.match(/`/g) || []).length % 2 === 1) shown += "`";
  return shown;
}
