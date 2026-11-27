// A small pill at the top centre that says what Chikki is doing right now, like a phone's dynamic island.
const TONES = {
  Listening: "#34d399",
  Thinking: "#a5b4fc",
  Speaking: "#f9a8d4",
  Trouble: "#fb923c",
};

export default function StatusPill({ label }) {
  if (!label) return null;
  return (
    <div className="status-pill" role="status" aria-live="polite" key={label}>
      <span className="status-pill-dot" style={{ background: TONES[label] || "#a5b4fc" }} aria-hidden="true" />
      {label}
    </div>
  );
}
