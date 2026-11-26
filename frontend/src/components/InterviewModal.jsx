import { useEffect, useState } from "react";
import { INTERVIEW_ROLES } from "../interview.js";

export default function InterviewModal({ isOpen, onClose, onStart }) {
  const [roleId, setRoleId] = useState(INTERVIEW_ROLES[0].id);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const role = INTERVIEW_ROLES.find((item) => item.id === roleId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono" role="dialog" aria-modal="true" aria-labelledby="interview-title">
      <div className="max-w-md w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl chikki-scroll">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="interview-title" className="text-sm font-bold text-chikki-purpleLight tracking-wide">INTERVIEW MODE</h2>
            <p className="mt-1 text-[11px] text-gray-400">
              Pick the role you are hiring for. Chikki answers five questions about Akash, then gives an honest fit verdict.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-300 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-gray-700">✕</button>
        </div>

        <div className="mt-4 space-y-2" role="radiogroup" aria-label="Role">
          {INTERVIEW_ROLES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={item.id === roleId}
              onClick={() => setRoleId(item.id)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                item.id === roleId ? "border-chikki-purple bg-chikki-purple/15 text-white" : "border-gray-800 text-gray-300 hover:border-gray-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <ol className="mt-4 space-y-1 text-[11px] text-gray-400">
          {role.questions.map((question, index) => (
            <li key={question}>{index + 1}. {question}</li>
          ))}
        </ol>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="action-button text-xs">Cancel</button>
          <button type="button" onClick={() => onStart(roleId)} className="action-button primary-action text-xs">Start interview</button>
        </div>
      </div>
    </div>
  );
}
