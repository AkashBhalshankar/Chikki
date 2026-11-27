import { useEffect, useState } from "react";

// Pulling the chat down while it is at the top shows a hint and, past the threshold, refreshes the page.
// The conversation is kept in the browser, so a refresh loses nothing. Touch screens only.
export default function usePullToRefresh(ref, { enabled = true, onRefresh, threshold = 70 } = {}) {
  const [pull, setPull] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return undefined;
    let startY = null;
    let distance = 0;
    const start = (event) => {
      startY = element.scrollTop <= 0 && event.touches.length === 1 ? event.touches[0].clientY : null;
      distance = 0;
    };
    const move = (event) => {
      if (startY === null) return;
      distance = Math.max(0, (event.touches[0].clientY - startY) * 0.5);
      setPull(Math.min(distance, threshold * 1.4));
    };
    const end = () => {
      if (startY !== null && distance >= threshold) onRefresh?.();
      startY = null;
      distance = 0;
      setPull(0);
    };
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", move, { passive: true });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", end);
    return () => {
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
    };
  }, [ref, enabled, onRefresh, threshold]);

  return { pull, ready: pull >= threshold };
}
