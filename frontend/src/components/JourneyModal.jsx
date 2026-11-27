import { useEffect } from "react";
import { journey } from "../play.js";

// Akash's work, grouped. Tap an entry and Chikki tells you about it. Dates are not shown because none are listed
// with the projects; the answers carry whatever the resume says.
export default function JourneyModal({ isOpen, onClose, onAsk }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono" role="dialog" aria-modal="true" aria-labelledby="journey-title">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="journey-title" className="text-sm font-bold tracking-wide text-chikki-purpleLight">WORK JOURNEY</h2>
            <p className="mt-1 text-[11px] text-gray-400">Tap anything to ask Chikki about it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-gray-700 bg-zinc-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-zinc-700 hover:text-white">✕</button>
        </div>
        <div className="chikki-scroll mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          {journey().map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group.title}</h3>
              <ol className="journey-line space-y-2">
                {group.items.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      className="journey-item"
                      onClick={() => {
                        onAsk(`Tell me about ${project.name}.`);
                        onClose();
                      }}
                    >
                      <span className="text-sm font-semibold text-gray-100">{project.name}</span>
                      <span className="text-[11px] text-chikki-purpleLight">{project.kind}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
