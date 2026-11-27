import { useEffect } from "react";

const SHORTCUTS = [
  ["/", "Jump to the question box (text chat)"],
  ["Enter", "Send your question"],
  ["Esc", "Close any open window"],
  ["?", "Show this list"],
  ["Ctrl + Shift + A", "Owner only: show or hide Analytics"],
];

export default function ShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <div className="max-w-sm w-full rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="shortcuts-title" className="text-sm font-bold text-chikki-purpleLight tracking-wide">KEYBOARD SHORTCUTS</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-300 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700">✕</button>
        </div>
        <dl className="mt-4 space-y-2.5 text-xs">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="flex items-center justify-between gap-4">
              <dt><kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-gray-300">{keys}</kbd></dt>
              <dd className="text-right text-gray-400">{what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
