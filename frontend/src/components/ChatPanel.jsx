import { useEffect, useRef, useState } from "react";
import AppFooter from "./AppFooter.jsx";
import LanguageSelector from "./LanguageSelector.jsx";

const QUICK_PROMPTS = {
  "en-IN": [
    "What AI projects has Akash built?",
    "Why is Akash a strong hire?",
    "What would Akash contribute in the first 90 days?",
    "How can I contact Akash?",
  ],
  "te-IN": [
    "ఆకాశ్ ఏ AI ప్రాజెక్ట్‌లు నిర్మించారు?",
    "ఆకాశ్‌ను ఎందుకు నియమించాలి?",
    "ఆకాశ్‌ను ఎలా సంప్రదించాలి?",
    "ఆకాశ్ నైపుణ్యాలు ఏమిటి?",
  ],
  "hi-IN": [
    "आकाश ने कौन से AI प्रोजेक्ट बनाए हैं?",
    "आकाश को क्यों नियुक्त करना चाहिए?",
    "मैं आकाश से कैसे संपर्क करूँ?",
    "आकाश की मुख्य तकनीकी कुशलताएँ क्या हैं?",
  ],
};

export default function ChatPanel({
  messages,
  onSend,
  thinking,
  onBack,
  onReturnHome,
  suggestions = [],
  actions = {},
  onFeedback,
  onDownloadResume,
  onOpenDashboard,
  language = "en-IN",
  onLanguageChange,
}) {
  const [value, setValue] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const [activeFeedbackMsgId, setActiveFeedbackMsgId] = useState(null);
  const [feedbackVote, setFeedbackVote] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const latestAssistantIndex = messages.reduce(
    (latest, message, index) => (message.role === "assistant" ? index : latest),
    -1
  );
  const currentPrompts = QUICK_PROMPTS[language] || QUICK_PROMPTS["en-IN"];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || thinking) return;
    onSend(trimmed);
    setValue("");
  };

  const handleVoteClick = (msgIndex, voteType) => {
    setActiveFeedbackMsgId(msgIndex);
    setFeedbackVote(voteType);
    setFeedbackSubmitted(false);
    setCommentText("");
    onFeedback(voteType);
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (feedbackVote) {
      onFeedback(feedbackVote, commentText.trim());
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setActiveFeedbackMsgId(null);
        setFeedbackVote(null);
      }, 2000);
    }
  };

  return (
    <div className="app-viewport dot-grid px-3 py-4 sm:px-8 sm:py-6 flex flex-col justify-between font-mono">
      <div className="app-shell flex flex-1 flex-col justify-between max-w-4xl mx-auto w-full">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-lg tracking-[0.18em] font-bold text-chikki-purpleLight">CHIKKI</h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gray-500">Text conversation</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <LanguageSelector language={language} onChange={onLanguageChange} />
            <button
              type="button"
              onClick={onOpenDashboard}
              className="action-button text-[11px] border-indigo-900/40 bg-indigo-950/20 text-indigo-300 hover:bg-indigo-900/30"
              title="View Feedback Analytics"
            >
              📊 Analytics
            </button>

            <span className="text-[10px] uppercase tracking-[0.18em] text-gray-400 hidden sm:inline">
              <span className="text-chikki-green mr-1">●</span> Online
            </span>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="action-button text-[11px]"
              >
                🎙️ Voice mode
              </button>
            )}
          </div>
        </header>

        {/* Quick Action Links */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {actions.resume && (
              <button
                type="button"
                onClick={onDownloadResume}
                className="action-button primary-action font-medium"
              >
                📄 Resume PDF
              </button>
            )}
            {actions.linkedin && (
              <a
                href={actions.linkedin}
                target="_blank"
                rel="noreferrer"
                onClick={onReturnHome}
                className="action-button"
              >
                LinkedIn
              </a>
            )}
            {actions.github && (
              <a
                href={actions.github}
                target="_blank"
                rel="noreferrer"
                onClick={onReturnHome}
                className="action-button"
              >
                GitHub
              </a>
            )}
            {actions.email && (
              <a
                href={`mailto:${actions.email}?subject=${encodeURIComponent("Interview opportunity for Akash Bhalshankar")}`}
                onClick={onReturnHome}
                className="action-button primary-action"
              >
                Contact Akash
              </a>
            )}
            {actions.phone && (
              <a href={`tel:${actions.phone.replace(/\s+/g, "")}`} onClick={onReturnHome} className="action-button">
                Call
              </a>
            )}
          </div>
          <span className="hidden md:inline-block text-[10px] text-gray-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">Enter</kbd> to send
          </span>
        </div>

        {/* Chat Body */}
        <div
          ref={scrollRef}
          className="chat-scroll-container surface-line chikki-scroll mt-3 w-full overflow-y-auto rounded-lg p-3 sm:p-4 space-y-4"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <p className="text-xs text-gray-400">
                Ask Chikki anything about Akash&apos;s experience, projects, or skills.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col ${
                m.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                <span>{m.role === "user" ? "👤 You" : "🤖 Chikki"}</span>
              </div>

              <div
                className={`max-w-[88%] sm:max-w-[78%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "bg-chikki-purple/20 border border-chikki-purple text-gray-100 rounded-br-none"
                    : m.isError
                    ? "bg-red-950/40 border border-red-800 text-red-200 rounded-bl-none"
                    : "bg-chikki-panel border border-gray-800 text-gray-200 rounded-bl-none"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {m.content}
                  {m.isStreaming && (
                    <span className="inline-block ml-1 animate-pulse text-chikki-purpleLight font-bold">▊</span>
                  )}
                </div>
              </div>

              {/* Feedback Action */}
              {m.role === "assistant" && i === latestAssistantIndex && onFeedback && (
                <div className="mt-2 flex flex-col items-start gap-1.5 ml-1">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="text-[10px]">Feedback:</span>
                    <button
                      type="button"
                      onClick={() => handleVoteClick(i, "helpful")}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                        feedbackVote === "helpful"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "hover:text-chikki-green"
                      }`}
                    >
                      👍 Like
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => handleVoteClick(i, "needs-improvement")}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                        feedbackVote === "needs-improvement"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          : "hover:text-red-400"
                      }`}
                    >
                      👎 Dislike
                    </button>
                  </div>

                  {activeFeedbackMsgId === i && (
                    <div className="mt-1 flex flex-col gap-1.5 p-2.5 rounded-lg border border-gray-800 bg-zinc-900/90 w-full max-w-sm">
                      {feedbackSubmitted ? (
                        <p className="text-[11px] text-emerald-400 font-medium">
                          ✓ Thanks! Feedback saved.
                        </p>
                      ) : (
                        <form onSubmit={handleCommentSubmit} className="flex flex-col gap-1.5">
                          <textarea
                            rows={2}
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Add detailed feedback (optional)..."
                            className="w-full rounded border border-gray-700 bg-zinc-950 p-2 text-[11px] text-gray-200 outline-none focus:border-chikki-purple resize-none"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActiveFeedbackMsgId(null)}
                              className="px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200"
                            >
                              Skip
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 rounded bg-chikki-purple/30 border border-chikki-purple text-chikki-purpleLight text-[10px] font-semibold hover:bg-chikki-purple/40"
                            >
                              Save Feedback
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="rounded-xl rounded-bl-none px-3.5 py-2.5 text-xs bg-chikki-panel border border-gray-800 text-gray-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-chikki-purple animate-ping" />
                <span>🤖 Chikki is thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {[...suggestions, ...currentPrompts].slice(0, 4).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSend(prompt)}
              disabled={thinking}
              className="prompt-button truncate disabled:opacity-40"
            >
              <span className="text-chikki-purpleLight mr-2">›</span> {prompt}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mt-2.5 flex w-full gap-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={thinking}
            placeholder="Ask about Akash's skills, projects..."
            className="flex-1 rounded-lg border border-gray-800 bg-chikki-panel px-3.5 py-2.5 text-xs sm:text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-chikki-purple disabled:opacity-50 min-h-[44px]"
          />
          <button
            type="submit"
            disabled={thinking || !value.trim()}
            className="action-button primary-action rounded-lg px-5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>

        <AppFooter />
      </div>
    </div>
  );
}