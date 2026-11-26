import { useEffect, useState } from "react";
import { matchJobDescription } from "../services/api.js";

function Section({ title, items, tone }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">{title}</div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className={`text-xs ${tone}`}>
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function JobMatchModal({ isOpen, onClose, onDownloadResume }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      setResult(await matchJobDescription(text));
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const reset = () => {
    setResult(null);
    setStatus("idle");
  };

  const scoreColor =
    result?.fit_score >= 70 ? "text-emerald-400" : result?.fit_score >= 40 ? "text-amber-300" : "text-rose-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
    >
      <div className="max-w-xl w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl chikki-scroll">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="match-title" className="text-sm font-bold text-chikki-purpleLight tracking-wide">
              HOW WELL DOES AKASH FIT YOUR ROLE?
            </h2>
            <p className="mt-1 text-[11px] text-gray-400">
              Paste a job description for an honest match based on his verified profile.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-300 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700"
          >
            ✕
          </button>
        </div>

        {status === "done" && result ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold ${scoreColor}`}>{result.fit_score}%</div>
              <p className="text-xs text-gray-300 leading-relaxed">{result.fit_summary}</p>
            </div>
            <Section title="Strong matches" items={result.matching_skills} tone="text-emerald-300" />
            <Section title="Gaps (honest view)" items={result.gaps} tone="text-amber-200" />
            <Section title="What Akash would highlight" items={result.talking_points} tone="text-gray-200" />
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button type="button" onClick={reset} className="action-button text-xs">
                Try another role
              </button>
              <button
                type="button"
                onClick={() => onDownloadResume?.(result.resume_focus)}
                className="action-button primary-action text-xs"
              >
                📄 Resume tailored to this role
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              AI-generated from the verified resume. The tailored PDF only reorders existing content.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <textarea
              required
              rows={9}
              minLength={40}
              maxLength={6000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste the job description here..."
              className="w-full rounded-lg border border-gray-700 bg-zinc-900 p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-chikki-purple resize-none"
            />
            {error && (
              <div role="alert" className="border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-500">{text.length}/6000</span>
              <button
                type="submit"
                disabled={status === "loading" || text.trim().length < 40}
                className="action-button primary-action text-xs disabled:opacity-50"
              >
                {status === "loading" ? "Analysing..." : "Check fit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
