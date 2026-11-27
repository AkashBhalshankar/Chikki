import { useEffect, useState } from "react";
import { plainText } from "../markdown.js";

export default function SavedModal({ isOpen, onClose, items, onRemove }) {
  const [copiedId, setCopiedId] = useState(null);
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const copy = async (item) => {
    try {
      await navigator.clipboard.writeText(`${item.question}\n\n${plainText(item.answer)}`);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (_) {
      setCopiedId(null);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono" role="dialog" aria-modal="true" aria-labelledby="saved-title">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="saved-title" className="text-sm font-bold tracking-wide text-chikki-purpleLight">⭐ SAVED ANSWERS</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-gray-700 bg-zinc-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-zinc-700 hover:text-white">✕</button>
        </div>
        {items.length === 0 ? (
          <p className="mt-4 text-xs text-gray-400">Tap ☆ Save under any answer to keep it here. Saved answers stay in this browser only.</p>
        ) : (
          <ul className="chikki-scroll mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-gray-800 bg-zinc-900/50 p-3 text-xs">
                <p className="font-semibold text-gray-100">{item.question}</p>
                <p className="mt-1 line-clamp-4 text-gray-400">{plainText(item.answer)}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => copy(item)} className="msg-action">{copiedId === item.id ? "✓ Copied" : "📋 Copy"}</button>
                  <button type="button" onClick={() => onRemove(item)} className="msg-action">🗑️ Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
