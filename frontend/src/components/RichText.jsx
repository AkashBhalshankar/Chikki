import { chipItems, parseBlocks, parseInline, splitStats } from "../markdown.js";

function Plain({ text }) {
  // numbers worth noticing (percentages, years, ranges) get a soft highlight
  return splitStats(text).map((piece, index) =>
    piece.stat ? <span key={index} className="stat">{piece.value}</span> : <span key={index}>{piece.value}</span>,
  );
}

function Inline({ text }) {
  return parseInline(text).map((part, index) => {
    // Bold text may itself hold a link, as in **[Name](https://...)**, so it is read again.
    if (part.type === "bold") return <strong key={index} className="font-semibold"><Inline text={part.value} /></strong>;
    if (part.type === "link") {
      return (
        <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="link-chip">
          {part.value}<span aria-hidden="true"> ↗</span>
        </a>
      );
    }
    if (part.type === "code") return <code key={index} className="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">{part.value}</code>;
    return <Plain key={index} text={part.value} />;
  });
}

// Asks a follow-up about just this line.
function QuoteButton({ text, onQuote }) {
  const line = text.replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
  if (!onQuote || line.length < 25) return null;
  return (
    <button type="button" className="quote-btn" title="Ask about this line" aria-label={`Ask about: ${line.slice(0, 60)}`} onClick={() => onQuote(line)}>
      ↩
    </button>
  );
}

// Renders a chat reply with its light formatting (paragraphs, bullets, chips, bold, code, tables).
export default function RichText({ text, onQuote }) {
  return parseBlocks(text).map((block, index) => {
    if (block.type === "table") {
      return (
        <div key={index} className="my-2 overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full border-collapse text-left text-[0.92em]">
            {block.header && (
              <thead className="bg-white/5 text-gray-300">
                <tr>
                  {block.header.map((cell, i) => (
                    <th key={i} className="px-2.5 py-1.5 font-semibold"><Inline text={cell} /></th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-t border-gray-800 align-top">
                  {row.map((cell, i) => (
                    <td key={i} className="px-2.5 py-1.5"><Inline text={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (block.type === "ul" && chipItems(block.items)) {
      // a list of short names (skills, tools) reads better as chips than as bullets
      return (
        <div key={index} className="my-2 flex flex-wrap gap-1.5">
          {block.items.map((item, i) => (
            <span key={i} className="skill-chip"><Inline text={item} /></span>
          ))}
        </div>
      );
    }
    if (block.type === "ul" || block.type === "ol") {
      const List = block.type === "ul" ? "ul" : "ol";
      return (
        <List key={index} className={`my-1.5 space-y-1 pl-5 ${block.type === "ul" ? "list-disc" : "list-decimal"} marker:text-chikki-purpleLight`}>
          {block.items.map((item, i) => (
            <li key={i}><Inline text={item} /><QuoteButton text={item} onQuote={onQuote} /></li>
          ))}
        </List>
      );
    }
    return (
      <p key={index} className="break-words [&:not(:first-child)]:mt-2.5">
        <Inline text={block.text} /><QuoteButton text={block.text} onQuote={onQuote} />
      </p>
    );
  });
}
