import { useEffect, useState } from "react";
import ChikkiBot from "./ChikkiBot.jsx";

// Playful working words, each with a face that suits it, so waiting for an answer feels alive.
const WORDS = [
  ["Searching", "curious"], ["Refining", "focused"], ["Baking", "happy"], ["Mustering", "determined"],
  ["Honking", "playful"], ["Computing", "thinking"], ["Unravelling", "confused"], ["Crunching", "determined"],
  ["Cooking", "joyful"], ["Brewing", "wink"], ["Weaving", "focused"], ["Distilling", "curious"],
  ["Pondering", "thinking"], ["Polishing", "proud"], ["Connecting dots", "curious"], ["Simmering", "relieved"],
];

function shuffled() {
  const list = [...WORDS];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function useWorkingWord(intervalMs = 1800) {
  const [order] = useState(shuffled);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % order.length), intervalMs);
    return () => clearInterval(timer);
  }, [order, intervalMs]);
  const [word, face] = order[index];
  return { word, face, index };
}

// Just the changing word (used under the robot in voice mode).
export function ThinkingWord({ className = "" }) {
  const { word, index } = useWorkingWord();
  return <span key={index} className={`thinking-word ${className}`}>{word}…</span>;
}

// The little robot, its face matching the word, plus the word itself (text chat).
export default function ThinkingIndicator() {
  const { word, face, index } = useWorkingWord();
  return (
    <div className="flex items-center gap-3 px-1 py-1 text-sm text-gray-400" role="status" aria-live="polite">
      <ChikkiBot state={face} size={78} />
      <span className="flex items-center gap-2">
        <span key={index} className="thinking-word">{word}…</span>
        <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
      </span>
    </div>
  );
}
