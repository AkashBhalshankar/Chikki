import { useEffect, useRef, useState } from "react";
import { readSettings } from "../settings.js";

// A soft glow that follows the mouse on desktop and swells over buttons and links. Not shown on touch screens, for
// people who prefer reduced motion, or when switched off in Settings.
export default function CursorGlow() {
  const [enabled, setEnabled] = useState(() => readSettings().cursor && !readSettings().calm);
  const ref = useRef(null);

  useEffect(() => {
    const refresh = () => setEnabled(readSettings().cursor && !readSettings().calm);
    window.addEventListener("chikki:settings", refresh);
    return () => window.removeEventListener("chikki:settings", refresh);
  }, []);

  useEffect(() => {
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || !fine || calm) return undefined;
    let frame = 0;
    let x = -200;
    let y = -200;
    const paint = () => {
      frame = 0;
      if (ref.current) ref.current.style.transform = `translate(${x - 60}px, ${y - 60}px)`;
    };
    const move = (event) => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
      const over = event.target instanceof Element && event.target.closest("button, a, [role='button'], input, textarea");
      ref.current?.classList.toggle("is-big", Boolean(over));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div ref={ref} className="cursor-glow" aria-hidden="true" />;
}
