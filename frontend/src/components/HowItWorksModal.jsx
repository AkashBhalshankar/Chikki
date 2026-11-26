import { useEffect } from "react";

const STEPS = [
  { icon: "🎙️", title: "You speak or type", text: "Voice uses your browser's speech recognition, with fixes for names and tech terms and a live \"I'm hearing\" preview. Text chat works without a microphone." },
  { icon: "🔌", title: "Real-time connection", text: "A WebSocket carries your question to a FastAPI backend, with rate limits, size caps and per-visitor connection limits." },
  { icon: "📚", title: "Finds the right facts", text: "Akash's live Google Drive resume is always in the prompt. Verified project write-ups are searched with keyword and embedding retrieval, so answers can cite their sources." },
  { icon: "🧠", title: "Reliable model routing", text: "Requests go to Groq, then Gemini, NVIDIA and OpenRouter. A circuit breaker skips a provider that just failed, so one outage does not stop the conversation." },
  { icon: "💬", title: "Streams the answer", text: "Words stream back as they are written. Detailed answers on request, and buttons (message, resume, role fit, book a call) only when you ask for them." },
  { icon: "🔊", title: "Speaks it back", text: "Each sentence becomes speech as soon as it is ready, in Telugu, Hindi or English to match the reply, with matching captions and an expressive robot." },
];

const PRINCIPLES = [
  "Grounded: answers come from the verified resume and write-ups, and Chikki says so when something is not there.",
  "Honest by design: the role-fit check lists real gaps, and the tailored resume only reorders existing content.",
  "Transparent: your questions are shared with Akash so he can improve Chikki and see what recruiters need. Please do not type anything private. No accounts, and no IP addresses are stored.",
  "Tested: automated tests, a build check on every change, and a set of answer-quality checks run against real models.",
  "Observable: tracing and usage analytics show where answers are slow, failing, or missing knowledge.",
];

export default function HowItWorksModal({ isOpen, onClose, githubUrl }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 font-mono"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-title"
    >
      <div className="max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-700 bg-[#0d0d12] p-5 shadow-2xl chikki-scroll">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="how-title" className="text-sm font-bold text-chikki-purpleLight tracking-wide">
              HOW CHIKKI WORKS
            </h2>
            <p className="mt-1 text-[11px] text-gray-400">
              A voice-first AI assistant built by Akash. Here is what happens when you ask a question.
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

        <ol className="mt-5 space-y-0">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
              {index < STEPS.length - 1 && (
                <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-chikki-purple/40" aria-hidden="true" />
              )}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-chikki-purple/60 bg-chikki-purple/15 text-sm">
                {step.icon}
              </span>
              <div>
                <h3 className="text-xs font-semibold text-gray-100">
                  {index + 1}. {step.title}
                </h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-gray-800 bg-zinc-900/40 p-4">
          <h3 className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Engineering principles</h3>
          <ul className="mt-2 space-y-1.5">
            {PRINCIPLES.map((item) => (
              <li key={item} className="text-[11px] leading-relaxed text-gray-300">
                • {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-[10px] text-gray-500">
          Built with React, Vite, Tailwind CSS and Framer Motion on the front end; Python, FastAPI and WebSockets on the back end.
        </p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noreferrer" className="action-button text-xs">
              View the code on GitHub
            </a>
          )}
          <button type="button" onClick={onClose} className="action-button primary-action text-xs">
            Back to Chikki
          </button>
        </div>
      </div>
    </div>
  );
}
