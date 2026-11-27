import { useEffect, useRef, useState } from "react";

// A tiny game for the wait while the server wakes up: catch the sparkles. It disappears when Chikki is ready.
export default function WakeGame() {
  const [score, setScore] = useState(0);
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  const timer = useRef(null);

  const hop = () => setSpot({ x: 8 + Math.random() * 78, y: 12 + Math.random() * 62 });

  useEffect(() => {
    timer.current = window.setInterval(hop, 1100);
    return () => window.clearInterval(timer.current);
  }, []);

  return (
    <div className="wake-game fit-hide-short" role="group" aria-label="A small game while Chikki wakes up">
      <div className="wake-game-field">
        <button
          type="button"
          className="wake-sparkle"
          style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          aria-label="Catch the sparkle"
          onClick={() => {
            setScore((value) => value + 1);
            hop();
          }}
        >
          ✨
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-400">Catch the sparkles while Chikki wakes up: <strong className="text-chikki-purpleLight">{score}</strong></p>
    </div>
  );
}
