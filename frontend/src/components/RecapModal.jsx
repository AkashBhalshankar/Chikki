import { useEffect, useState } from "react";
import { buildRecap, recapMailto } from "../recap.js";

export default function RecapModal({ isOpen, onClose, messages }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!isOpen) return undefined;
    setCopied(false);
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const { turns, text } = buildRecap(messages);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) {
      setCopied(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono" role="dialog" aria-modal="true" aria-labelledby="recap-title">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="recap-title" className="text-sm font-bold tracking-wide text-chikki-purpleLight">CHAT RECAP</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-gray-700 bg-zinc-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-zinc-700 hover:text-white">✕</button>
        </div>
        {turns.length === 0 ? (
          <p className="mt-4 text-xs text-gray-400">Nothing to summarise yet. Ask Chikki something first.</p>
        ) : (
          <>
            <ol className="chikki-scroll mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-xs">
              {turns.map((turn, index) => (
                <li key={index}>
                  <p className="font-semibold text-gray-100">{index + 1}. {turn.question}</p>
                  {turn.answer && <p className="mt-0.5 text-gray-400">{turn.answer}</p>}
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="action-button primary-action text-xs">{copied ? "✓ Copied" : "📋 Copy"}</button>
              <a href={recapMailto(text)} className="action-button text-xs">✉️ Email it to me</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
