import { parseBlocks, parseInline } from "../markdown.js";

function Inline({ text }) {
  return parseInline(text).map((part, index) => {
    if (part.type === "bold") return <strong key={index} className="font-semibold">{part.value}</strong>;
    if (part.type === "code") return <code key={index} className="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">{part.value}</code>;
    return <span key={index}>{part.value}</span>;
  });
}

// Renders a chat reply with its light formatting (paragraphs, bullets, bold, code).
export default function RichText({ text }) {
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
    if (block.type === "ul" || block.type === "ol") {
      const List = block.type === "ul" ? "ul" : "ol";
      return (
        <List key={index} className={`my-1.5 space-y-1 pl-5 ${block.type === "ul" ? "list-disc" : "list-decimal"} marker:text-chikki-purpleLight`}>
          {block.items.map((item, i) => (
            <li key={i}><Inline text={item} /></li>
          ))}
        </List>
      );
    }
    return (
      <p key={index} className="break-words [&:not(:first-child)]:mt-2.5">
        <Inline text={block.text} />
      </p>
    );
  });
}
