import { useEffect, useState } from "react";
import { sendContactMessage } from "../services/api.js";

const EMPTY_FORM = { name: "", email: "", company: "", message: "", website: "" };

export default function ContactModal({ isOpen, onClose, onSent, topics = "", bookingUrl = "" }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setStatus("idle");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      await sendContactMessage({ ...form, topics });
      setStatus("sent");
      onSent?.();
      setForm(EMPTY_FORM);
    } catch (err) {
      setStatus("error");
      setError(err.message || "Could not send your message.");
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-chikki-purple";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-title"
    >
      <div className="max-w-md w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl chikki-scroll">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="contact-title" className="text-sm font-bold text-chikki-purpleLight tracking-wide">
              CONTACT AKASH
            </h2>
            <p className="mt-1 text-[11px] text-gray-400">Send a message here and he'll reply by email.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {bookingUrl && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-chikki-purple bg-chikki-purple/20 px-3 py-2 text-xs font-semibold text-chikki-purpleLight hover:bg-chikki-purple/30"
          >
            📅 Prefer to talk? Book a call directly
          </a>
        )}

        {status === "sent" ? (
          <div className="mt-5 space-y-3 text-center">
            <p className="text-sm text-emerald-400 font-semibold">✓ Message sent!</p>
            <p className="text-xs text-gray-400">Thanks for reaching out. Akash will get back to you soon.</p>
            <button type="button" onClick={onClose} className="action-button primary-action text-xs">
              Back to Chikki
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Name *</span>
              <input required maxLength={100} value={form.name} onChange={update("name")} className={inputClass} autoComplete="name" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Email *</span>
              <input required type="email" maxLength={254} value={form.email} onChange={update("email")} className={inputClass} autoComplete="email" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Company</span>
              <input maxLength={120} value={form.company} onChange={update("company")} className={inputClass} autoComplete="organization" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Message *</span>
              <textarea
                required
                rows={4}
                maxLength={2000}
                value={form.message}
                onChange={update("message")}
                placeholder="Role, team, or what you'd like to discuss..."
                className={`${inputClass} resize-none`}
              />
            </label>
            {/* Honeypot field: hidden from people, often filled by bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} />
              </label>
            </div>

            {topics && (
              <p className="text-[10px] text-gray-500">
                Topics you asked Chikki about will be included: <span className="text-gray-400">{topics}</span>
              </p>
            )}

            {error && (
              <div role="alert" className="border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700 text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "sending"}
                className="action-button primary-action text-xs disabled:opacity-50"
              >
                {status === "sending" ? "Sending..." : "Send message"}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
