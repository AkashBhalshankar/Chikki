import { useEffect, useRef, useState } from "react";
import { setGaze } from "../gaze.js";

// A sparkle you can drag around: Chikki's eyes follow it. Arrow keys move it too, for keyboard users.
export default function PlayOrb({ onClose }) {
  const [pos, setPos] = useState(() => ({ x: Math.max(40, window.innerWidth - 90), y: Math.round(window.innerHeight * 0.45) }));
  const dragging = useRef(false);

  const move = (x, y) => {
    const next = {
      x: Math.min(Math.max(24, x), window.innerWidth - 24),
      y: Math.min(Math.max(24, y), window.innerHeight - 24),
    };
    setPos(next);
    setGaze(next);
  };

  useEffect(() => {
    setGaze(pos);
    return () => setGaze(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="play-orb-wrap" style={{ left: pos.x, top: pos.y }}>
      <button
        type="button"
        className="play-orb"
        aria-label="Sparkle. Drag it, or use the arrow keys, and Chikki's eyes follow it"
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => dragging.current && move(event.clientX, event.clientY)}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        onKeyDown={(event) => {
          const step = 28;
          const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
          if (delta) {
            event.preventDefault();
            move(pos.x + delta[0], pos.y + delta[1]);
          }
        }}
      >
        ✨
      </button>
      <button type="button" className="play-orb-close" onClick={onClose} aria-label="Put the sparkle away">✕</button>
    </div>
  );
}
