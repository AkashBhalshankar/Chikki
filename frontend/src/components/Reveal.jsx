import { useEffect, useState } from "react";
import RichText from "./RichText.jsx";
import { revealSlice } from "../markdown.js";

const prefersLessMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_) {
    return false;
  }
};

// Shows a reply that is arriving as if it were being typed: smoothly, a few characters at a time, instead of in
// bursts. A reply loaded from history (not streaming when it first appears) is shown whole.
export default function Reveal({ text, streaming = false, onQuote }) {
  const [animate] = useState(() => streaming && !prefersLessMotion());
  const [shown, setShown] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate) {
      setShown(text.length);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setShown((count) => {
        const left = text.length - count;
        return left <= 0 ? count : count + Math.max(1, Math.ceil(left / 9));
      });
    }, 22);
    return () => window.clearInterval(timer);
  }, [animate, text]);

  const done = shown >= text.length;
  return (
    <>
      <RichText text={animate ? revealSlice(text, shown) : text} onQuote={done && !streaming ? onQuote : undefined} />
      {animate && (!done || streaming) && <span className="ml-1 inline-block animate-pulse font-bold text-chikki-purpleLight">▊</span>}
    </>
  );
}
