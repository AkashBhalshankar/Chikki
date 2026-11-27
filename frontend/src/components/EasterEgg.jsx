import { useEffect, useState } from "react";
import { EGG_JOKES } from "../play.js";

const COLORS = ["#F4D77A", "#F28BA5", "#97C459", "#8FE1D8", "#D85A30", "#AFA9EC"];

// The hidden surprise: confetti, a party face and a joke. Found with the Konami code or a triple-click on the title.
export default function EasterEgg({ token }) {
  const [visible, setVisible] = useState(false);
  const [joke, setJoke] = useState(EGG_JOKES[0]);

  useEffect(() => {
    if (!token) return undefined;
    setJoke(EGG_JOKES[token % EGG_JOKES.length]);
    setVisible(true);
    window.dispatchEvent(new CustomEvent("chikki:react", { detail: { name: "celebrate", ms: 3200 } }));
    const timer = window.setTimeout(() => setVisible(false), 6500);
    return () => window.clearTimeout(timer);
  }, [token]);

  if (!visible) return null;
  return (
    <div className="egg" role="status" aria-live="polite">
      <div className="egg-confetti" aria-hidden="true">
        {Array.from({ length: 44 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 11) * 90}ms`, animationDuration: `${1.8 + (i % 5) * 0.35}s` }} />
        ))}
      </div>
      <div className="egg-card">
        <div className="text-sm font-semibold text-white">🎉 You found the secret!</div>
        <p className="mt-1 text-xs text-gray-300">{joke}</p>
      </div>
    </div>
  );
}
