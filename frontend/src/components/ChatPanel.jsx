import { Fragment, useEffect, useRef, useState } from "react";
import AppFooter from "./AppFooter.jsx";
import LanguageSelector from "./LanguageSelector.jsx";
import { isMobileDevice, telHref } from "../device.js";
import MoreMenu from "./MoreMenu.jsx";
import RichText from "./RichText.jsx";
import { ProjectCard } from "./ProjectsModal.jsx";
import { projectsMentioned } from "../projects.js";
import { nextStep } from "../interview.js";
import ChikkiBot from "./ChikkiBot.jsx";
import ThinkingIndicator from "./ThinkingIndicator.jsx";
import { plainText } from "../markdown.js";
import { shareAnswerCard } from "../answerCard.js";
import Reveal from "./Reveal.jsx";
import { timeMarker } from "../chatTime.js";
import usePullToRefresh from "../hooks/usePullToRefresh.js";
import { buzz } from "../haptics.js";
import { ProfileLine } from "./ProfileBadge.jsx";

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

const ACTION_BUTTONS = {
  contact: { label: "✉️ Contact Akash", handler: "onOpenContact" },
  resume: { label: "📄 Download resume", handler: "onDownloadResume" },
  role_fit: { label: "🎯 Check role fit", handler: "onOpenMatch" },
  booking: { label: "📅 Book a call", handler: "onOpenBooking" },
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
  onOpenContact,
  onOpenMatch,
  onOpenBooking,
  onShare,
  onOpenHow,
  onOpenProjects,
  onOpenSettings,
  onOpenShortcuts,
  onOpenInterview,
  interview = null,
  onInterviewNext,
  onInterviewEnd,
  onClear,
  adminUi = false,
  theme = "dark",
  onToggleTheme,
  language = "en-IN",
  onLanguageChange,
  onOpenRecap,
  chikkiState = "idle",
  chikkiExpression = "confident",
}) {
  const [value, setValue] = useState("");
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  const { pull, ready: pullReady } = usePullToRefresh(scrollRef, {
    enabled: isTouch && !thinking,
    onRefresh: () => {
      buzz(15);
      window.location.reload();
    },
  });
  const inputRef = useRef(null);

  const [activeFeedbackMsgId, setActiveFeedbackMsgId] = useState(null);
  const [feedbackVote, setFeedbackVote] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [whyOpen, setWhyOpen] = useState(null);
  const [cardState, setCardState] = useState({ index: null, label: "" });
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopyAnswer = async (index, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1800);
    } catch (_) {
      window.prompt("Copy this answer:", text);
    }
  };
  const [canCall] = useState(() => isMobileDevice());
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!confirmClear) return undefined;
    const timer = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  const handleClearClick = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    setActiveFeedbackMsgId(null);
    setFeedbackVote(null);
    onClear?.();
  };

  const handleShareClick = async () => {
    const copied = await onShare?.();
    if (copied) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const latestAssistantIndex = messages.reduce(
    (latest, message, index) => (message.role === "assistant" ? index : latest),
    -1
  );
  const actionHandlers = { onOpenContact, onDownloadResume, onOpenMatch, onOpenBooking };
  const currentPrompts = QUICK_PROMPTS[language] || QUICK_PROMPTS["en-IN"];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleShareCard = async (index) => {
    const question = messages[index - 1]?.role === "user" ? messages[index - 1].content : "";
    const answer = plainText(messages[index].history_content || messages[index].content);
    setCardState({ index, label: "Preparing…" });
    try {
      const outcome = await shareAnswerCard({ question, answer });
      setCardState({ index, label: outcome === "cancelled" ? "" : outcome === "shared" ? "✓ Shared" : "✓ Saved" });
    } catch (_) {
      setCardState({ index, label: "Could not make the card" });
    }
    setTimeout(() => setCardState({ index: null, label: "" }), 2200);
  };

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

  const renderActions = (direction) => (
    <>
            {actions.resume && (
              <button
                type="button"
                onClick={onDownloadResume}
                className="action-button primary-action font-medium"
              >
                📄 Resume PDF
              </button>
            )}
            {onOpenContact && (
              <button type="button" onClick={onOpenContact} className="action-button primary-action">
                ✉️ Contact Akash
              </button>
            )}
            {onOpenMatch && (
              <button type="button" onClick={onOpenMatch} className="action-button">
                🎯 Check role fit
              </button>
            )}
            <MoreMenu
              direction={direction}
              items={[
                onOpenProjects && { key: "projects", label: "🗂️ Projects", onClick: onOpenProjects },
                onOpenSettings && { key: "settings", label: "⚙️ Settings", onClick: onOpenSettings },
                onOpenShortcuts && { key: "shortcuts", label: "⌨️ Keyboard shortcuts", onClick: onOpenShortcuts },
                onOpenInterview && { key: "interview", label: "🎤 Interview mode", onClick: onOpenInterview },
                onOpenRecap && messages.length > 0 && { key: "recap", label: "📝 Summarise our chat", onClick: onOpenRecap },
                onOpenHow && { key: "how", label: "🧠 How Chikki works", onClick: onOpenHow },
                onShare && { key: "share", label: linkCopied ? "✓ Link copied" : "🔗 Copy link", onClick: handleShareClick, keepOpen: true },
                canCall && actions.phone && { key: "call", label: "📞 Call Akash", href: telHref(actions.phone) },
                actions.linkedin && { key: "linkedin", label: "💼 LinkedIn", href: actions.linkedin },
                actions.github && { key: "github", label: "💻 GitHub", href: actions.github },
                onToggleTheme && { key: "theme", label: theme === "light" ? "🌙 Dark theme" : "☀️ Light theme", onClick: onToggleTheme },
                onClear && messages.length > 0 && {
                  key: "clear",
                  label: confirmClear ? "⚠️ Click again to confirm" : "🗑️ Clear chat",
                  onClick: handleClearClick,
                  keepOpen: !confirmClear,
                  danger: true,
                },
              ]}
            />
    </>
  );

  return (
    <div className="view-fade chat-viewport dot-grid px-3 py-4 sm:px-8 sm:py-6 flex flex-col font-mono">
      <div className="app-shell chat-shell flex min-h-0 flex-1 flex-col mx-auto w-full">
        
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-lg tracking-[0.18em] font-bold text-chikki-purpleLight">CHIKKI</h1>
            <ProfileLine />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <LanguageSelector language={language} onChange={onLanguageChange} />
            {adminUi && (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="action-button text-[11px] border-indigo-900/40 bg-indigo-950/20 text-indigo-300 hover:bg-indigo-900/30"
                title="View Feedback Analytics"
              >
                📊 Analytics
              </button>
            )}

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

        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-6">
        {/* Chikki stays in place while only the messages scroll */}
        <aside className={`chat-chikki ${scrolled ? "is-mini" : ""} flex shrink-0 items-center gap-3 lg:w-[270px] lg:flex-col lg:justify-center lg:gap-3`} aria-label="Chikki">
          <ChikkiBot state={chikkiState} expression={chikkiExpression} className="h-auto w-14 shrink-0 sm:w-16 lg:w-56" />
          <div className="chat-chikki-text min-w-0 lg:text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-chikki-purpleLight">
              {thinking ? "Thinking…" : messages.length ? "Ask me more" : "Hi, I'm Chikki"}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-500 lg:max-w-[220px]">
              Answers come from Akash&apos;s verified resume.
            </p>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {pull > 0 && (
          <div className="flex items-center justify-center overflow-hidden text-[11px] text-gray-400 transition-[height]" style={{ height: pull * 0.6 }} aria-hidden="true">
            {pullReady ? "Release to refresh" : "↓ Pull to refresh"}
          </div>
        )}
        {/* Quick Action Links */}
        <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {renderActions("down")}
          </div>
          <span className="hidden md:inline-block text-[10px] text-gray-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">Enter</kbd> to send
          </span>
        </div>

        {/* Chat Body */}
        <div
          ref={scrollRef}
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 48)}
          className="chat-scroll-container surface-line chikki-scroll mt-3 w-full overflow-y-auto rounded-lg p-3 sm:p-4 space-y-4"
          role="log"
          aria-live="polite"
          aria-label="Conversation with Chikki"
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <h2 className="text-lg font-semibold text-gray-100">Hi, I&apos;m Chikki 👋</h2>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-gray-400">
                Ask about Akash&apos;s experience, projects and skills.
              </p>
              <div className="mt-5 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {currentPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onSend(prompt)}
                    disabled={thinking}
                    className="prompt-button justify-start disabled:opacity-40"
                  >
                    <span className="mr-2 text-chikki-purpleLight">›</span> {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            m.role === "assistant" && !m.isError && !m.content?.trim() ? null : (
            <Fragment key={i}>
            {(() => {
              const marker = timeMarker(messages.slice(0, i).reverse().find((x) => Number.isFinite(x.at))?.at, m.at);
              return marker ? <div className="time-marker" role="separator">{marker}</div> : null;
            })()}
            <div
              className={`msg-enter group flex flex-col ${
                m.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                <span>{m.role === "user" ? "👤 You" : "🤖 Chikki"}</span>
              </div>

              <div
                className={`${m.role === "user" ? "max-w-[88%] sm:max-w-[78%]" : "max-w-[96%] sm:max-w-[88%]"} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  m.role === "user"
                    ? "user-bubble bg-chikki-purple/20 border border-chikki-purple text-gray-100 rounded-br-none shadow-sm"
                    : m.isError
                    ? "bg-red-950/40 border border-red-800 text-red-200 rounded-bl-none"
                    : "answer-card bg-chikki-panel/60 text-gray-200 rounded-bl-none"
                }`}
              >
                <div className="break-words">
                  {m.role === "assistant" && !m.isError ? (
                    <Reveal
                      text={m.content}
                      streaming={Boolean(m.isStreaming)}
                      onQuote={i === latestAssistantIndex && m.final && !thinking ? (line) => onSend(`About this: "${line.slice(0, 140)}". Can you explain that a bit more?`) : undefined}
                    />
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>

              {m.role === "assistant" && m.final && !m.isError && m.content?.trim() && (
                <div className={`msg-actions mt-1 ml-1 flex flex-wrap items-center gap-1 text-[11px] text-gray-500 ${i === latestAssistantIndex ? "" : "msg-actions-quiet"}`}>
                  <button type="button" onClick={() => handleCopyAnswer(i, plainText(m.history_content || m.content))} className="msg-action">
                    {copiedIndex === i ? "✓ Copied" : "📋 Copy"}
                  </button>
                  <button type="button" onClick={() => handleShareCard(i)} className="msg-action" title="Make a picture of this answer to share">
                    {cardState.index === i && cardState.label ? cardState.label : "🖼️ Share"}
                  </button>
                  {i === latestAssistantIndex && !thinking && !/in detail/i.test(messages[i - 1]?.content || "") && (
                    <button type="button" onClick={() => onSend("Tell me more about that in detail.")} className="msg-action">
                      ➕ More detail
                    </button>
                  )}
                  {i === latestAssistantIndex && onFeedback && (
                    <>
                      <button
                        type="button"
                        aria-label="Helpful"
                        title="Helpful"
                        onClick={() => handleVoteClick(i, "helpful")}
                        className={`msg-action ${feedbackVote === "helpful" ? "!border-emerald-500/40 !bg-emerald-500/20 !text-emerald-400" : ""}`}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        aria-label="Needs improvement"
                        title="Needs improvement"
                        onClick={() => handleVoteClick(i, "needs-improvement")}
                        className={`msg-action ${feedbackVote === "needs-improvement" ? "!border-rose-500/40 !bg-rose-500/20 !text-rose-400" : ""}`}
                      >
                        👎
                      </button>
                    </>
                  )}
                </div>
              )}

              {m.role === "assistant" && i === latestAssistantIndex && m.final && !m.isError && m.actions?.length > 0 && (
                <div className="mt-2 ml-1 flex flex-wrap gap-2">
                  {m.actions.map((name) => {
                    const config = ACTION_BUTTONS[name];
                    const handler = config && actionHandlers[config.handler];
                    if (!handler) return null;
                    return (
                      <button key={name} type="button" onClick={handler} className="action-button primary-action text-xs">
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {m.role === "assistant" && i === latestAssistantIndex && m.final && !m.isError && projectsMentioned(m.content).length > 0 && (
                <div className="mt-2 ml-1 grid max-w-[96%] gap-2 sm:max-w-[88%] sm:grid-cols-2">
                  {projectsMentioned(m.content).map((project) => (
                    <ProjectCard key={project.id} project={project} compact />
                  ))}
                </div>
              )}

              {m.role === "assistant" && m.final && !m.isError && (m.verified || m.sources?.length > 0) && (
                <div className="mt-1.5 ml-1 flex max-w-[88%] flex-wrap items-center gap-1 text-[10px] text-gray-500">
                  {m.verified && (
                    <span title="Every name, number and claim in this answer was checked against Akash's resume" className="mr-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                      ✓ Checked against the resume
                    </span>
                  )}
                  {m.sources?.some((source) => source.excerpt) && (
                    <button
                      type="button"
                      onClick={() => setWhyOpen((open) => (open === i ? null : i))}
                      aria-expanded={whyOpen === i}
                      className="mr-1 rounded-full border border-gray-700 px-2 py-0.5 text-gray-400 transition-colors hover:text-chikki-purpleLight"
                    >
                      🔎 Why this answer?
                    </button>
                  )}
                  {m.sources?.length > 0 && <span className="uppercase tracking-wider">Sources:</span>}
                  {m.sources.map((source) => {
                    const label = source.section && source.section !== source.title
                      ? `${source.title} · ${source.section}`
                      : source.title;
                    return source.url ? (
                      <a
                        key={`${source.title}-${source.section}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-gray-800 bg-zinc-900/60 px-1.5 py-0.5 text-gray-400 hover:text-chikki-purpleLight"
                      >
                        {label}
                      </a>
                    ) : (
                      <span
                        key={`${source.title}-${source.section}`}
                        className="rounded border border-gray-800 bg-zinc-900/60 px-1.5 py-0.5 text-gray-400"
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}

              {whyOpen === i && m.sources?.some((source) => source.excerpt) && (
                <div className="mt-2 ml-1 max-w-[96%] space-y-2 rounded-lg border border-gray-800 bg-zinc-900/60 p-3 text-[11px] leading-relaxed text-gray-300 sm:max-w-[88%]">
                  <p className="text-gray-400">Notes Chikki looked up for this answer. It also reads Akash&apos;s full resume every time.</p>
                  {m.sources.filter((source) => source.excerpt).map((source) => (
                    <div key={`${source.title}-${source.section}`}>
                      <div className="font-semibold text-gray-200">{source.section && source.section !== source.title ? `${source.title} · ${source.section}` : source.title}</div>
                      <p className="mt-0.5 text-gray-400">“{source.excerpt}”</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback Action */}
              {m.role === "assistant" && i === latestAssistantIndex && m.final && !m.isError && onFeedback && (
                <div className="mt-2 flex flex-col items-start gap-1.5 ml-1">
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
            </Fragment>
            )
          ))}

          {thinking && !(messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content?.trim() && !messages[messages.length - 1]?.final) && <ThinkingIndicator />}
        </div>

        {interview && (() => {
          const step = nextStep(interview.role, interview.asked);
          return (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-chikki-purple/40 bg-chikki-purple/10 px-3 py-2 text-xs">
              <span className="text-gray-200">
                🎤 Interview: <strong className="font-semibold">{interview.role.label}</strong>
                {step.kind === "done" ? " · finished" : ""}
              </span>
              <span className="flex gap-2">
                {step.kind !== "done" && (
                  <button type="button" disabled={thinking} onClick={onInterviewNext} className="action-button primary-action text-xs disabled:opacity-50">
                    {step.label} →
                  </button>
                )}
                <button type="button" onClick={onInterviewEnd} className="action-button text-xs">{step.kind === "done" ? "Close" : "End"}</button>
              </span>
            </div>
          );
        })()}

        {/* Quick Suggestion Chips */}
        <div className={`mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 ${messages.length === 0 ? "hidden" : ""}`}>
          {[...suggestions, ...currentPrompts].slice(0, 4).map((prompt, index) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSend(prompt)}
              disabled={thinking}
              className={`prompt-button truncate disabled:opacity-40 ${index >= 2 ? "chip-extra" : ""}`}
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
            aria-label="Ask Chikki a question"
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

        {/* On phones the main actions sit at the bottom, within thumb reach */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 border-t border-gray-800 pt-2 sm:hidden">
          {renderActions("up")}
        </div>

        <div className="hidden sm:block">
          <AppFooter />
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}