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
