import { useEffect, useState } from "react";

// Playful working words, so waiting for an answer feels alive instead of a static line.
const WORDS = [
  "Searching", "Refining", "Baking", "Mustering", "Honking", "Computing", "Unravelling", "Crunching",
  "Cooking", "Brewing", "Weaving", "Distilling", "Pondering", "Polishing", "Connecting dots", "Simmering",
];

function shuffled() {
  const list = [...WORDS];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export default function ThinkingIndicator() {
  const [order] = useState(shuffled);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % order.length), 1800);
    return () => clearInterval(timer);
  }, [order]);

  return (
    <div className="flex items-center gap-2.5 px-1 py-1 text-sm text-gray-400" role="status" aria-live="polite">
      <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
      <span key={index} className="thinking-word">{order[index]}…</span>
    </div>
  );
}
