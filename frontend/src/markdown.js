// A tiny, safe formatter for chat replies: paragraphs, "- " bullets, numbered lines, **bold** and `code`.
// It returns plain data (no HTML), so a reply can never inject markup into the page.

const BULLET = /^\s*(?:[-*\u2022])\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseBlocks(text = "") {
  const blocks = [];
  let list = null;
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
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
  // A blank line ends a paragraph; lines inside one paragraph were already joined above.
  return blocks.map(({ openParagraph, ...block }) => block);
}

// Splits a line into plain, bold and code pieces. An unfinished marker (while a reply is still
// streaming) stays as plain text instead of flashing as broken formatting.
export function parseInline(text = "") {
  const parts = [];
  const pattern = /\*\*([^*]+?)\*\*|`([^`]+?)`/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    parts.push(match[1] !== undefined ? { type: "bold", value: match[1] } : { type: "code", value: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

// The same reply without formatting marks, for "Copy answer".
export function plainText(text = "") {
  return text
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/^\s*[-*\u2022]\s+/gm, "• ");
}
