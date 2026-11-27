import { useCallback, useEffect, useRef, useState } from "react";
import ChikkiBot from "./components/ChikkiBot.jsx";
import StandbyScreen from "./components/StandbyScreen.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import AppFooter from "./components/AppFooter.jsx";
import FeedbackDashboard from "./components/FeedbackDashboard.jsx";
import ContactModal from "./components/ContactModal.jsx";
import JobMatchModal from "./components/JobMatchModal.jsx";
import HowItWorksModal from "./components/HowItWorksModal.jsx";
import { buildShareUrl, readSharedLink } from "./sharedLink.js";
import { cleanForBrowserSpeech } from "./speechText.js";
import { resumeFocusFromMessages } from "./focus.js";
import { isMobileDevice, telHref } from "./device.js";
import { adminFromSearch, isToggleShortcut, readAdminUi, writeAdminUi } from "./adminMode.js";
import { applyTheme, nextTheme, readTheme } from "./theme.js";
import MoreMenu from "./components/MoreMenu.jsx";
import ListeningWave from "./components/ListeningWave.jsx";
import { ProfileLine } from "./components/ProfileBadge.jsx";
import LanguageSelector from "./components/LanguageSelector.jsx";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition.js";
import { voiceLogLines } from "./voiceLog.js";
import { plainText } from "./markdown.js";
import { attachLevelMeter } from "./voiceLevel.js";
import { ThinkingWord } from "./components/ThinkingIndicator.jsx";
import ProjectsModal from "./components/ProjectsModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import ShortcutsModal from "./components/ShortcutsModal.jsx";
import { readSettings } from "./settings.js";
import { playChime } from "./sounds.js";
import { buzz } from "./haptics.js";
import ConnectionBanner from "./components/ConnectionBanner.jsx";
import useDialogFocus from "./hooks/useDialogFocus.js";
import { glowFor, reactionForTranscript } from "./expressions.js";
import RecapModal from "./components/RecapModal.jsx";
import InterviewModal from "./components/InterviewModal.jsx";
import { nextStep, roleById } from "./interview.js";
import { expressionForTurn, expressionForUserInput } from "./expressions.js";
import { connectVoiceSocket, downloadResumePdf, fetchGreetingAudio, sendFeedback, sendVisit, sendVoiceMetric, wakeServer } from "./services/api.js";

const NO_SPEECH_FALLBACK_THRESHOLD = 3;
const CHAT_HISTORY_KEY = "chikki_chat_history";
const EXPRESSION_HOLD_MS = 3000;

function createTurnId() {
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isJokeRequest(text = "") {
  return /\b(joke|funny|make me laugh|crack me up)\b|జోక్|నవ్వు|चुटकुला|चुटकुले|जोक|हंसाओ|मज़ेदार/i.test(text);
}

const QUICK_PROMPTS = {
  "en-IN": [
    "Tell me about Akash's strongest AI project.",
    "Why should a company hire Akash?",
    "Tell me a developer joke.",
    "Explain Akash's technical skills simply.",
  ],
  "te-IN": [
    "ఆకాశ్ ప్రాజెక్ట్స్ గురించి చెప్పు.",
    "కంపెనీలు ఆకాశ్‌ను ఎందుకు హైర్ చేసుకోవాలి?",
    "ఒక మంచి జోక్ చెప్పు.",
    "ఆకాశ్ టెక్నికల్ స్కిల్స్ వివరించు.",
  ],
  "hi-IN": [
    "आकाश के सबसे अच्छे AI प्रोजेक्ट के बारे में बताओ।",
    "कंपनियों को आकाश को क्यों हायर करना चाहिए?",
    "एक डेवलपर जोक सुनाओ।",
    "आकाश की टेक्निकल स्किल्स बताओ।",
  ],
};

const CONTACT_ACTIONS = {
  linkedin: import.meta.env.VITE_LINKEDIN_URL,
  github: import.meta.env.VITE_GITHUB_URL,
  email: import.meta.env.VITE_CONTACT_EMAIL || "",
  phone: import.meta.env.VITE_CONTACT_PHONE || "",
  booking: import.meta.env.VITE_BOOKING_URL || "",
  resume: import.meta.env.VITE_RESUME_URL || `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/resume`,
};

const WAKE_GREETINGS = {
  "en-IN": [
    "Hey there! I'm Chikki. I'm here to help you learn about Akash - what would you like to know?",
    "Hi! Great to have you here. I'm Chikki, Akash's AI assistant. Ask me anything about him.",
    "Hey, I'm listening! I'm Chikki - happy to tell you about Akash's experience, skills, or projects.",
  ],
  "te-IN": [
    "నమస్కారం! నేను చిక్కీని. ఆకాశ్ అనుభవం, స్కిల్స్ లేదా ప్రాజెక్ట్‌ల గురించి మీరు నన్ను అడగవచ్చు.",
    "హలో! నేను చిక్కీ. ఆకాశ్ కెరీర్ మరియు ప్రాజెక్ట్స్ గురించి ఏం తెలుసుకోవాలనుకుంటున్నారు?",
  ],
  "hi-IN": [
    "नमस्ते! मैं चिक्की हूँ। आकाश के अनुभव, स्किल्स या प्रोजेक्ट्स के बारे में आप कुछ भी पूछ सकते हैं।",
    "हेलो! मैं चिक्की, आकाश की AI असिस्टेंट। बताइए मैं आपकी क्या मदद कर सकती हूँ?",
  ],
};

const EXPRESSION_LABELS = {
  celebrate: ["Celebrating!", "CELEBRATE"],
  happy: ["That makes me happy!", "HAPPY"],
  excited: ["That is exciting!", "EXCITED"],
  surprised: ["Oh!", "SURPRISED"],
  sad: ["I understand.", "CONCERNED"],
  love: ["That is lovely.", "WARM"],
  wink: ["You got it.", "READY"],
  concerned: ["Let me take a closer look.", "CONCERNED"],
  proud: ["Nicely done.", "PROUD"],
  curious: ["I’m curious about that.", "CURIOUS"],
  playful: ["Let’s have some fun.", "PLAYFUL"],
  encouraging: ["You’ve got this.", "ENCOURAGING"],
  neutral: ["I’m listening.", "LISTENING"],
  relieved: ["That’s a relief.", "RELIEVED"],
  apologetic: ["I’m sorry about that.", "SORRY"],
  confident: ["I can help with that.", "CONFIDENT"],
  skeptical: ["Let’s check that carefully.", "SKEPTICAL"],
  grateful: ["I appreciate that.", "GRATEFUL"],
  focused: ["Hmm... let me think.", "THINKING"],
  confused: ["Hmm, I did not catch that.", "CONFUSED"],
  nod: ["Got it.", "GOT IT"],
  interrupted: ["Oh, go ahead!", "LISTENING"],
  sleepy: ["Zzz... say something to wake me.", "SLEEPY"],
  ready: ["Ready when you are.", "READY"],
  determined: ["I’ll work through it.", "DETERMINED"],
  shy: ["Aww, that's kind of you!", "SHY"],
  joyful: ["That makes me so happy!", "JOYFUL"],
  laughing: ["Haha! That got me.", "LAUGHING"],
};

function loadStoredMessages() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    // a damaged or hand-edited history must never stop the page from loading
    return Array.isArray(saved)
      ? saved.filter((m) => m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      : [];
  } catch (_) {
    return [];
  }
}

// Browser text-to-speech fallback. Used only when the backend sends a text
// reply but no audio (e.g. edge-tts is blocked/broken), so Chikki can still
// speak. Free, built into the browser, and never rate-limited or blocked.
let browserSpeechText = ""; // what the browser voice is saying now, so it is not mistaken for the visitor

function speakWithBrowser(rawText, lang, { onStart, onEnd, onUnavailable } = {}) {
  const text = cleanForBrowserSpeech(rawText || "");
  if (!("speechSynthesis" in window) || !text) {
    onUnavailable?.();
    onEnd?.();
    return;
  }
  browserSpeechText = text;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang || "en-IN";
  const voices = window.speechSynthesis.getVoices();
  const match =
    voices.find((v) => v.lang === utterance.lang) ||
    voices.find((v) => v.lang.startsWith(utterance.lang.slice(0, 2)));
  if (match) utterance.voice = match;
  let started = false;
  utterance.onstart = () => {
    started = true;
    onStart?.();
  };
  utterance.onend = () => {
    browserSpeechText = "";
    onEnd?.();
  };
  utterance.onerror = () => {
    browserSpeechText = "";
    if (!started) onUnavailable?.();
    onEnd?.();
  };
  window.speechSynthesis.speak(utterance);
}

// True when most of the heard words are ones Chikki itself is saying (speaker bleed into the mic).
function isEchoOfAssistant(heard, spokenSoFar) {
  const words = (text) => (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  const heardWords = words(heard);
  if (heardWords.length === 0) return true;
  const spoken = new Set(words(`${spokenSoFar} ${audioQueue.currentText} ${browserSpeechText}`));
  const overlap = heardWords.filter((word) => spoken.has(word)).length;
  return overlap / heardWords.length >= 0.6;
}

// Global Audio Queue
const audioQueue = {
  queue: [],
  isPlaying: false,
  currentAudio: null,
  currentText: "",
  stopMeter: null,
  progressFrame: null,
  onPlayChunk: null,
  onPlayStateChange: null,
  onQueueEmpty: null, // Callback to persistently flip state back to 'listening'

  enqueue(src, chunkText = "", turnId = null) {
    if (!src) return;
    this.queue.push({ src, text: chunkText, turnId });
    if (!this.isPlaying) {
      this.playNext();
    }
  },

  playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.currentAudio = null;
      if (this.onPlayStateChange) this.onPlayStateChange(false);
      if (this.onQueueEmpty) this.onQueueEmpty();
      return;
    }

    this.isPlaying = true;
    if (this.onPlayStateChange) this.onPlayStateChange(true);

    if (this.progressFrame !== null) {
      cancelAnimationFrame(this.progressFrame);
      this.progressFrame = null;
    }

    const item = this.queue.shift();
    this.currentText = item.text || "";

    // Reveal subtitle words in step with the current audio clip.
    if (this.onPlayChunk && item.text) {
      this.onPlayChunk(item.text, 0, item.turnId);
    }

    const audio = new Audio(item.src);
    audio.volume = 0.85;
    this.currentAudio = audio;

    const wordCount = item.text.trim().split(/\s+/).filter(Boolean).length;
    let revealedWordCount = 0;
    const updateSubtitle = () => {
      if (this.currentAudio !== audio || audio.paused) return;
      const progress = Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.min(1, audio.currentTime / audio.duration)
        : 0;
      const nextWordCount = Math.max(revealedWordCount, Math.ceil(wordCount * progress));
      if (nextWordCount !== revealedWordCount) {
        revealedWordCount = nextWordCount;
        this.onPlayChunk?.(item.text, progress, item.turnId);
      }
      this.progressFrame = requestAnimationFrame(updateSubtitle);
    };

    audio.onplaying = () => {
      this.stopMeter?.();
      this.stopMeter = attachLevelMeter(audio);
      if (wordCount > 0) {
        revealedWordCount = 1;
        this.onPlayChunk?.(item.text, 1 / wordCount, item.turnId);
      }
      this.progressFrame = requestAnimationFrame(updateSubtitle);
    };

    audio.onended = () => {
      this.stopMeter?.();
      this.stopMeter = null;
      if (this.progressFrame !== null) {
        cancelAnimationFrame(this.progressFrame);
        this.progressFrame = null;
      }
      this.onPlayChunk?.(item.text, 1, item.turnId);
      // Clean up object URLs to prevent memory leaks
      if (item.src.startsWith("blob:")) {
        URL.revokeObjectURL(item.src);
      }
      this.playNext();
    };

    audio.onerror = () => {
      this.stopMeter?.();
      this.stopMeter = null;
      if (this.progressFrame !== null) {
        cancelAnimationFrame(this.progressFrame);
        this.progressFrame = null;
      }
      if (item.src.startsWith("blob:")) {
        URL.revokeObjectURL(item.src);
      }
      this.playNext();
    };

    audio.play().catch(() => {
      if (this.progressFrame !== null) {
        cancelAnimationFrame(this.progressFrame);
        this.progressFrame = null;
      }
      if (item.src.startsWith("blob:")) {
        URL.revokeObjectURL(item.src);
      }
      this.playNext();
    });
  },

  stopAll() {
    this.stopMeter?.();
    this.stopMeter = null;
    // Revoke any pending queued blob URLs
    this.queue.forEach((item) => {
      if (item.src?.startsWith("blob:")) {
        URL.revokeObjectURL(item.src);
      }
    });
    this.queue = [];

    if (this.progressFrame !== null) {
      cancelAnimationFrame(this.progressFrame);
      this.progressFrame = null;
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.src = "";
      this.currentAudio = null;
    }

    this.isPlaying = false;
    this.currentText = "";
    if (this.onPlayStateChange) this.onPlayStateChange(false);
    if (this.onQueueEmpty) this.onQueueEmpty();
  },
};
export default function App() {
  // Read the address options before the shared-link code below removes them from the URL.
  // ?admin and ?theme are removed from the address once read so they are not shared by accident.
  const [adminUi, setAdminUi] = useState(() => {
    const flag = adminFromSearch(window.location.search);
    if (flag !== null) writeAdminUi(flag);
    return flag === null ? readAdminUi() : flag;
  });
  const [theme, setTheme] = useState(() => applyTheme(readTheme(window.location.search)));
  useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("admin") || params.has("theme")) {
        params.delete("admin");
        params.delete("theme");
        const rest = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
      }
    } catch (_) {}
  });
  const toggleTheme = useCallback(() => setTheme((current) => applyTheme(nextTheme(current))), []);

  // Chikki waves hello when the page first opens, then settles.
  useEffect(() => {
    setChikkiState((current) => (current === "idle" ? "greet" : current));
    const timer = window.setTimeout(() => setChikkiState((current) => (current === "greet" ? "idle" : current)), 3600);
    return () => window.clearTimeout(timer);
  }, []);

  // Free hosting sleeps when idle. Wake it as soon as the page opens and say so if it takes a while.
  useEffect(() => {
    let cancelled = false;
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setServerState((state) => (state === "checking" ? "waking" : state));
    }, 2000);
    wakeServer().then(() => {
      if (!cancelled) setServerState("ready");
    });
    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, []);

  useEffect(() => {
    writeAdminUi(adminUi);
  }, [adminUi]);

  useEffect(() => {
    const onKey = (event) => {
      if (isToggleShortcut(event)) {
        event.preventDefault();
        setAdminUi((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [active, setActive] = useState(false);
  const [sharedLink] = useState(() => {
    const link = readSharedLink(window.location.search);
    if (link) {
      try {
        window.history.replaceState({}, "", window.location.pathname);
      } catch (_) {}
    }
    return link;
  });
  const sharedPendingRef = useRef(sharedLink?.question || null);
  const [chikkiState, setChikkiState] = useState("idle");
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [micError, setMicError] = useState(false);
  const [currentLang, setCurrentLang] = useState("en-IN");
  const [inputMode, setInputMode] = useState("voice");
  const [showTypeSuggestion, setShowTypeSuggestion] = useState(false);
  const [messages, setMessages] = useState(loadStoredMessages);
  const [chatThinking, setChatThinking] = useState(false);
  const [followUpSuggestions, setFollowUpSuggestions] = useState([]);
  const [voiceExpression, setVoiceExpression] = useState("confident");

  // Telemetry Dashboard Modal
  const [showDashboard, setShowDashboard] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [canCall] = useState(() => isMobileDevice());
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceNotice, setVoiceNotice] = useState("");
  const liveTranscriptTimerRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const voiceNoticeTimerRef = useRef(null);
  const openContact = useCallback(() => setShowContact(true), []);
  const closeContact = useCallback(() => setShowContact(false), []);
  const [showHow, setShowHow] = useState(false);
  const openHow = useCallback(() => setShowHow(true), []);
  const closeHow = useCallback(() => setShowHow(false), []);
  const [prefs, setPrefs] = useState(readSettings);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const closeShortcuts = useCallback(() => setShowShortcuts(false), []);
  const openShortcuts = useCallback(() => setShowShortcuts(true), []);
  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (event.key === "?" && !event.ctrlKey && !event.metaKey && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        setShowShortcuts((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const [showProjects, setShowProjects] = useState(false);
  const openProjects = useCallback(() => setShowProjects(true), []);
  const closeProjects = useCallback(() => setShowProjects(false), []);
  // Chikki looks around after a quiet spell and dozes off after a longer one; he wakes when you speak, tap or type.
  const [idleLook, setIdleLook] = useState(null);
  useEffect(() => {
    setIdleLook(null);
    const quiet = inputMode === "voice" ? chikkiState === "listening" && !liveTranscript : inputMode === "chat" && !chatThinking;
    if (!quiet) return undefined;
    let timers = [];
    const arm = () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers = [
        window.setTimeout(() => setIdleLook("curious"), 25000),
        window.setTimeout(() => setIdleLook(null), 29000),
        window.setTimeout(() => setIdleLook("sleepy"), 60000),
      ];
    };
    const touch = () => {
      setIdleLook(null);
      arm();
    };
    arm();
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [chikkiState, liveTranscript, inputMode, chatThinking, messages.length]);
  // on a phone, a swipe in from the right edge opens the More menu
  useEffect(() => {
    let startX = null;
    let startY = 0;
    const down = (event) => {
      const touch = event.touches[0];
      startX = touch.clientX > window.innerWidth - 28 ? touch.clientX : null;
      startY = touch.clientY;
    };
    const up = (event) => {
      if (startX === null) return;
      const touch = event.changedTouches[0];
      if (startX - touch.clientX > 70 && Math.abs(touch.clientY - startY) < 60) window.dispatchEvent(new Event("chikki:open-menu"));
      startX = null;
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchend", up, { passive: true });
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchend", up);
    };
  }, []);
  // the face shown on the voice screen: a nod or surprise while the visitor is still speaking
  const faceState = idleLook || (chikkiState === "listening" && liveTranscript ? reactionForTranscript(liveTranscript) || chikkiState : chikkiState);
  const glowState = inputMode === "chat" ? (chatThinking ? "thinking" : voiceExpression) : faceState;
  useEffect(() => {
    const rgb = glowFor(glowState);
    if (rgb) document.documentElement.style.setProperty("--mood-rgb", rgb);
    else document.documentElement.style.removeProperty("--mood-rgb");
  }, [glowState]);
  useDialogFocus();
  useEffect(() => {
    document.documentElement.lang = { "te-IN": "te", "hi-IN": "hi" }[currentLang] || "en";
  }, [currentLang]);
  // connection notice: shown when the phone is offline, or the socket has stayed closed for a few seconds
  const [socketLost, setSocketLost] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const lostTimerRef = useRef(null);
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);
  const [showRecap, setShowRecap] = useState(false);
  const openRecap = useCallback(() => setShowRecap(true), []);
  const closeRecap = useCallback(() => setShowRecap(false), []);
  const [showInterview, setShowInterview] = useState(false);
  const openInterview = useCallback(() => setShowInterview(true), []);
  const closeInterview = useCallback(() => setShowInterview(false), []);
  const [interview, setInterview] = useState(null); // { role, asked }
  const [showMatch, setShowMatch] = useState(false);
  const openMatch = useCallback(() => setShowMatch(true), []);
  const closeMatch = useCallback(() => setShowMatch(false), []);

  // Session tracking
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem("chikki_session_id");
    if (!sid) {
      sid = "sess_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
      sessionStorage.setItem("chikki_session_id", sid);
    }
    return sid;
  });

  // One visit per browser session, so Analytics can show how many visitors go on to ask or get in touch.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("chikki_visit_sent")) return;
      sessionStorage.setItem("chikki_visit_sent", "1");
    } catch (_) {}
    sendVisit(sessionId);
  }, [sessionId]);

  const [currentTraceId, setCurrentTraceId] = useState(null);
  const currentTraceIdRef = useRef(null);
  const lastPromptRef = useRef("");

    // Inline Feedback State
  const [voiceFeedbackVote, setVoiceFeedbackVote] = useState(null);
  const [voiceComment, setVoiceComment] = useState("");
  const [showVoiceCommentBox, setShowVoiceCommentBox] = useState(false);
  const [voiceFeedbackSaved, setVoiceFeedbackSaved] = useState(false);

  // Sync trace ID and reset turn feedback for each new message
  useEffect(() => {
    currentTraceIdRef.current = currentTraceId;
    setVoiceFeedbackVote(null);
    setVoiceComment("");
    setShowVoiceCommentBox(false);
    setVoiceFeedbackSaved(false);
  }, [currentTraceId]);

  // Persist chat history to localStorage without saving transient stream state
  useEffect(() => {
    try {
      const toStore = messages
        .filter((message) => message.content?.trim())
        .map(({ isStreaming, history_content, ...rest }) => ({
          ...rest,
          content: history_content || rest.content,
        }));
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toStore));
      messagesRef.current = messages;
    } catch (_) {}
  }, [messages]);

  const socketRef = useRef(null);
  const socketReadyRef = useRef(false);
  const pendingMessageRef = useRef(null);
  const activeTurnIdRef = useRef(null);

  const replyExpressionRef = useRef("confident");
  const resumeFocusRef = useRef("");
  const expressionHoldTimerRef = useRef(null);
  const messagesRef = useRef(messages);
  const spokenTextRef = useRef("");
  const receivedAudioForTurnRef = useRef(false);
  const noSpeechCountRef = useRef(0);
  const voiceTurnStartRef = useRef(null);
  const turnMoodRef = useRef(null); // the model's chosen mood for the current reply
  const flashTimerRef = useRef(null);
  const lastSttMetricRef = useRef(0);
  const [serverState, setServerState] = useState("checking"); // checking | waking | ready
  const debugVoice = useState(() => new URLSearchParams(window.location.search).has("debug"))[0];
  const [, setLogTick] = useState(0);
  useEffect(() => {
    if (!debugVoice) return undefined;
    const refresh = () => setLogTick((n) => n + 1);
    window.addEventListener("chikki-voice-log", refresh);
    return () => window.removeEventListener("chikki-voice-log", refresh);
  }, [debugVoice]);
  const [tapAssist, setTapAssist] = useState(false); // shows the tap button once voice needs help
  const inputModeRef = useRef(inputMode);
  const currentLangRef = useRef(currentLang);

  useEffect(() => {
    currentLangRef.current = currentLang;
  }, [currentLang]);

  useEffect(() => {
    inputModeRef.current = inputMode;
  }, [inputMode]);

  // Audio queue event bindings
  useEffect(() => {
    audioQueue.onPlayChunk = (chunkText, progress, turnId) => {
      if (turnId !== activeTurnIdRef.current) return;

      const words = chunkText.trim().split(/\s+/).filter(Boolean);
      const visibleChunk = words
        .slice(0, Math.ceil(words.length * progress))
        .join(" ");
      const currentReply = [spokenTextRef.current, visibleChunk]
        .filter(Boolean)
        .join(" ");

      if (progress >= 1) {
        spokenTextRef.current = currentReply;
      }

      if (currentReply) {
        const expression = expressionForTurn(turnMoodRef.current, currentReply);
        replyExpressionRef.current = expression;
        setVoiceExpression(expression);
      }

      setMessages((prev) => {
        const copy = [...prev];
        const turnIndex = copy.findIndex(
          (message) => message.role === "assistant" && message.turn_id === turnId
        );
        if (turnIndex >= 0) copy[turnIndex] = { ...copy[turnIndex], content: currentReply };
        return copy;
      });
    };

    audioQueue.onPlayStateChange = (playing) => {
      setIsAssistantSpeaking(playing);
      if (playing) {
        setChikkiState("speaking");
      } else {
        if (inputModeRef.current === "voice") {
          setChikkiState(replyExpressionRef.current || "confident");
          if (expressionHoldTimerRef.current) window.clearTimeout(expressionHoldTimerRef.current);
          expressionHoldTimerRef.current = window.setTimeout(() => {
            setChikkiState("listening");
          }, EXPRESSION_HOLD_MS);
        }
      }
    };
  }, []);

  const baseSuggestionsForReply = (reply) => {
    const text = reply.toLowerCase();
    if (currentLang === "te-IN") {
      return ["ఆకాశ్ ప్రాజెక్ట్ టెక్నాలజీలు ఏమిటి?", "ఆకాశ్ డెవలపర్ కథ చెప్పండి."];
    }
    if (currentLang === "hi-IN") {
      return ["आकाश ने कौनसी टेक्नोलॉजी इस्तेमाल की?", "आकाश के बारे में और बताओ।"];
    }
    if (/project|built|system|application/.test(text)) return ["What technologies did he use?", "What was the hardest part?"];
    if (/skill|python|langgraph|fastapi|ai engineer/.test(text)) return ["Tell me about a project using that skill.", "Can you explain this technically?"];
    if (/joke|funny|laugh/.test(text)) return ["Tell me another tech joke.", "What is Akash's developer story?"];
    return ["Tell me more about Akash's experience.", "Why should a company hire him?"];
  };

  const suggestionsForReply = (reply) => {
    const base = baseSuggestionsForReply(reply);
    if (/joke|funny|laugh/i.test(reply)) return base;
    const more = {
      "te-IN": "దీని గురించి వివరంగా చెప్పు.",
      "hi-IN": "इसके बारे में विस्तार से बताओ।",
    }[currentLang] || "Tell me more about that.";
    return [more, base[0]];
  };

  // Shows a face for a moment (celebration, thanks, surprise...) then returns to listening.
  const flashExpression = useCallback((name, ms = 2200) => {
    if (inputModeRef.current !== "voice") return;
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setChikkiState(name);
    flashTimerRef.current = window.setTimeout(() => {
      setChikkiState((current) => (current === name ? "listening" : current));
    }, ms);
  }, []);

  const handleContactSent = useCallback(() => flashExpression("celebrate", 3000), [flashExpression]);

  const unlockAudioContext = () => {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      audio.play().catch(() => {});
    } catch (_) {}
  };

  // Chikki dozes off after a minute with nobody talking, and wakes the moment someone speaks.
  useEffect(() => {
    if (chikkiState !== "listening" || inputMode !== "voice" || !active) return undefined;
    const timer = window.setTimeout(() => setChikkiState((current) => (current === "listening" ? "sleepy" : current)), 60000);
    return () => window.clearTimeout(timer);
  }, [chikkiState, inputMode, active]);

  // Stops both the normal audio queue and any browser-TTS fallback speech.
  const stopAudioImmediate = useCallback(() => {
    audioQueue.stopAll();
    window.speechSynthesis?.cancel();
  }, []);

  const handleWake = useCallback(() => {
    stopAudioImmediate();
    unlockAudioContext();
    setInputMode("voice");
    setActive(true);
    setChikkiState("wake");

    setTimeout(async () => {
      setChikkiState("greet");
      const greetingsList = WAKE_GREETINGS[currentLangRef.current] || WAKE_GREETINGS["en-IN"];
      const greeting = greetingsList[Math.floor(Math.random() * greetingsList.length)];

      try {
        const audioUrl = await fetchGreetingAudio(greeting, currentLangRef.current, { voice_pref: readSettings().voice, speed: readSettings().speed });
        setChikkiState("speaking");

        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setChikkiState("ready");
          window.setTimeout(() => setChikkiState((current) => (current === "ready" ? "listening" : current)), 1200);
        };
        await audio.play();
      } catch {
        // Backend TTS failed - speak the greeting with the browser voice instead.
        speakWithBrowser(greeting, currentLangRef.current, {
          onStart: () => setChikkiState("speaking"),
          onEnd: () => setChikkiState("listening"),
        });
      }
    }, 250);
  }, [stopAudioImmediate]);

  // Returns true when the visitor interrupted Chikki.
  const handleInterimSpeech = useCallback((interimText, whileSpeaking = false) => {
    if (!interimText) return false;
    setChikkiState((current) => (current === "sleepy" ? "listening" : current));
    const speakingNow = whileSpeaking || audioQueue.isPlaying || isAssistantSpeaking;

    // Show what Chikki is hearing so the visitor can see recognition problems early.
    if (!speakingNow) {
      setLiveTranscript(interimText);
      if (liveTranscriptTimerRef.current) window.clearTimeout(liveTranscriptTimerRef.current);
      liveTranscriptTimerRef.current = window.setTimeout(() => setLiveTranscript(""), 4000);
    }

    // While Chikki is speaking, only a stop command or a real phrase that is not Chikki's own
    // voice coming back through the microphone counts as the visitor talking over it.
    if (speakingNow) {
      const trimmed = interimText.trim().toLowerCase();
      const words = trimmed.split(/\s+/).filter(Boolean);
      const isStopWord = /^(stop|wait|hold on|pause|listen|chikki|quiet|ఆగు|ఆపండి|రుకో|रुको|चुप)/i.test(trimmed);
      if ((isStopWord || words.length >= 4) && !isEchoOfAssistant(trimmed, spokenTextRef.current)) {
        activeTurnIdRef.current = null;
        stopAudioImmediate();
        socketRef.current?.interrupt();
        flashExpression("interrupted", 900);
        return true;
      }
      return false;
    }

    if (activeTurnIdRef.current || audioQueue.queue.length > 0) {
      activeTurnIdRef.current = null;
      stopAudioImmediate();
      socketRef.current?.interrupt();
      if (inputModeRef.current === "voice") setChikkiState("listening");
    }
    return false;
  }, [stopAudioImmediate, isAssistantSpeaking, flashExpression]);

  const handleUnclear = useCallback((heard) => {
    setLiveTranscript("");
    setTapAssist(true);
    flashExpression("confused", 2600);
    setVoiceNotice(`I'm not sure I heard that right (“${heard}”). Could you say it again?`);
    if (voiceNoticeTimerRef.current) window.clearTimeout(voiceNoticeTimerRef.current);
    voiceNoticeTimerRef.current = window.setTimeout(() => setVoiceNotice(""), 5000);
  }, [flashExpression]);

  const handleResult = useCallback((transcript) => {
    if (!transcript) return;
    setLiveTranscript("");
    setVoiceNotice("");

    const turnId = createTurnId();
    activeTurnIdRef.current = turnId;
    spokenTextRef.current = "";
    turnMoodRef.current = null;
    receivedAudioForTurnRef.current = false;
    stopAudioImmediate();
    socketRef.current?.interrupt();

    setShowVoiceCommentBox(false);
    setVoiceFeedbackVote(null);
    setVoiceFeedbackSaved(false);
    lastPromptRef.current = transcript;

    const userMessage = { role: "user", content: transcript, turn_id: turnId, at: Date.now() };
    const assistantMessage = { role: "assistant", content: "", turn_id: turnId, final: false, at: Date.now() };
    messagesRef.current = [...messagesRef.current, userMessage, assistantMessage];
    setMessages(messagesRef.current);
    resumeFocusRef.current = messagesRef.current
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join(" ");

    if (expressionHoldTimerRef.current) window.clearTimeout(expressionHoldTimerRef.current);

    const userExp = expressionForUserInput(transcript);
    setChikkiState(userExp);
    setFollowUpSuggestions([]);

    const voice = inputModeRef.current === "voice";
    const language = currentLangRef.current;
    voiceTurnStartRef.current = voice ? performance.now() : null;

    if (!socketRef.current || !socketReadyRef.current) {
      pendingMessageRef.current = { text: transcript, voice, language, turnId };
      setTimeout(() => setChikkiState("thinking"), 250);
      return;
    }

    const prefs = readSettings();
    const sent = socketRef.current.send(transcript, { voice, session_id: sessionId, language, turn_id: turnId, voice_pref: prefs.voice, speed: prefs.speed });
    if (!sent) {
      pendingMessageRef.current = { text: transcript, voice, language, turnId };
      socketReadyRef.current = false;
      setTimeout(() => setChikkiState("thinking"), 250);
    } else {
      setTimeout(() => setChikkiState("thinking"), 350);
    }
  }, [sessionId, stopAudioImmediate]);

  const handleChatSend = useCallback((text) => {
    const turnId = createTurnId();
    activeTurnIdRef.current = turnId;
    spokenTextRef.current = "";
    receivedAudioForTurnRef.current = false;
    stopAudioImmediate();
    socketRef.current?.interrupt();

    lastPromptRef.current = text;
    const userMessage = { role: "user", content: text, turn_id: turnId, at: Date.now() };
    const assistantMessage = { role: "assistant", content: "", turn_id: turnId, final: false, at: Date.now() };
    messagesRef.current = [...messagesRef.current, userMessage, assistantMessage];
    setMessages(messagesRef.current);
    resumeFocusRef.current = messagesRef.current
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join(" ");
    setChatThinking(true);
    buzz(10);
    setFollowUpSuggestions([]);
    const language = currentLangRef.current;

    if (!socketRef.current || !socketReadyRef.current) {
      pendingMessageRef.current = { text, voice: false, language, turnId };
      return;
    }

    const sent = socketRef.current.send(text, { voice: false, session_id: sessionId, language, turn_id: turnId });
    if (!sent) {
      pendingMessageRef.current = { text, voice: false, language, turnId };
      socketReadyRef.current = false;
    }
  }, [sessionId, stopAudioImmediate]);

  const startInterview = useCallback((roleId) => {
    const role = roleById(roleId);
    if (!role) return;
    setShowInterview(false);
    setInputMode("chat");
    setActive(true);
    setInterview({ role, asked: 1 });
    handleChatSend(role.questions[0]);
  }, [handleChatSend]);

  const interviewNext = useCallback(() => {
    setInterview((current) => {
      if (!current) return current;
      const step = nextStep(current.role, current.asked);
      if (step.kind === "done") return current;
      handleChatSend(step.text);
      return { ...current, asked: current.asked + 1 };
    });
  }, [handleChatSend]);

  const interviewEnd = useCallback(() => setInterview(null), []);

  const handleFeedback = useCallback((value, comment = null) => {
    const lastAssistantMsg = [...messagesRef.current]
      .reverse()
      .find((m) => m.role === "assistant" && !m.isError);

    const activeTrace = lastAssistantMsg?.trace_id || currentTraceIdRef.current;

    sendFeedback({
      value,
      question: lastPromptRef.current || "",
      reply: lastAssistantMsg?.content || "",
      mode: inputModeRef.current === "voice" ? "voice" : "chat",
      user_comment: comment || undefined,
      trace_id: activeTrace,
      session_id: sessionId,
    });
  }, [sessionId]);

  const handleVoiceVote = (vote) => {
    setVoiceFeedbackVote(vote);
    setShowVoiceCommentBox(true);
    setVoiceFeedbackSaved(false);
    setVoiceComment("");
    handleFeedback(vote);
    if (vote === "helpful") flashExpression("grateful", 2200);
  };

  const handleVoiceCommentSubmit = (e) => {
    e.preventDefault();
    if (voiceFeedbackVote) {
      handleFeedback(voiceFeedbackVote, voiceComment.trim());
      setVoiceFeedbackSaved(true);
      setTimeout(() => {
        setShowVoiceCommentBox(false);
      }, 2000);
    }
  };

  const returnToVoiceHome = useCallback(() => {
    stopAudioImmediate();
    socketRef.current?.interrupt();
    unlockAudioContext();
    if (expressionHoldTimerRef.current) window.clearTimeout(expressionHoldTimerRef.current);
    setInputMode("voice");
    setActive(true);
    setChikkiState("listening");
    setVoiceExpression("confident");
    setFollowUpSuggestions([]);
    setChatThinking(false);
    setShowTypeSuggestion(false);
    setShowDashboard(false);
    noSpeechCountRef.current = 0;
  }, [stopAudioImmediate]);

  const handleCloseDashboard = useCallback(() => {
    setShowDashboard(false);
    if (inputModeRef.current === "chat") returnToVoiceHome();
  }, [returnToVoiceHome]);

  const handleDownloadResume = useCallback(async () => {
    const focus = resumeFocusFromMessages(messagesRef.current);
    try {
      await downloadResumePdf(CONTACT_ACTIONS.resume, focus, CONTACT_ACTIONS);
    } catch {
      const fallbackUrl = new URL(CONTACT_ACTIONS.resume, window.location.origin);
      window.location.assign(fallbackUrl);
    } finally {
      if (inputModeRef.current === "chat") returnToVoiceHome();
    }
  }, [returnToVoiceHome]);

  const handleClearChat = useCallback(() => {
    stopAudioImmediate();
    socketRef.current?.interrupt();
    activeTurnIdRef.current = null;
    pendingMessageRef.current = null;
    sharedPendingRef.current = null;
    lastPromptRef.current = "";
    resumeFocusRef.current = "";
    messagesRef.current = [];
    setMessages([]);
    setFollowUpSuggestions([]);
    setChatThinking(false);
    // Forget the conversation on the server too, so replies start fresh.
    socketRef.current?.sync([], []);
  }, [stopAudioImmediate]);

  const handleShare = useCallback(async () => {
    const lastQuestion = [...messagesRef.current].reverse().find((m) => m.role === "user")?.content;
    const url = buildShareUrl(lastQuestion);
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (_) {
      window.prompt("Copy this link:", url);
      return false;
    }
  }, []);

  const handleDownloadTailoredResume = useCallback(async (focus) => {
    try {
      await downloadResumePdf(CONTACT_ACTIONS.resume, focus || "", CONTACT_ACTIONS);
    } catch {
      window.location.assign(new URL(CONTACT_ACTIONS.resume, window.location.origin));
    }
  }, []);

  const handleSpeechError = useCallback((kind) => {
    if (kind === "not-allowed" || kind === "audio-capture" || kind === "not-supported") {
      setInputMode("chat");
      if (!active) setActive(true);
      return;
    }

    if (kind && kind !== "no-speech" && kind !== "aborted") setTapAssist(true);

    if (kind === "no-speech") {
      noSpeechCountRef.current += 1;
      if (noSpeechCountRef.current >= NO_SPEECH_FALLBACK_THRESHOLD) {
        setShowTypeSuggestion(true);
        setTapAssist(true);
      }
    }
  }, [active]);

  const handleResultWithReset = useCallback((transcript) => {
    noSpeechCountRef.current = 0;
    handleResult(transcript);
  }, [handleResult]);

  const handleServerSttFailed = useCallback(() => {
    if (Date.now() - lastSttMetricRef.current < 60000) return;
    lastSttMetricRef.current = Date.now();
    sendVoiceMetric("stt_fallback", null, currentLangRef.current);
    setTapAssist(true);
  }, []);

  const { supported, startListening, finishNow } = useSpeechRecognition({
    mode: inputMode === "chat" ? "off" : active ? "command" : "wake",
    lang: currentLang,
    isAssistantSpeaking,
    onWake: handleWake,
    onResult: handleResultWithReset,
    onInterim: handleInterimSpeech,
    onUnclear: handleUnclear,
    onSpeechError: handleSpeechError,
    onServerSttFailed: handleServerSttFailed,
  });

  const handleEnableMic = useCallback(() => {
    playChime("listen");
    stopAudioImmediate();
    unlockAudioContext();
    setInputMode("voice");
    setActive(true);
    setChikkiState("listening");
    startListening?.();
  }, [startListening, stopAudioImmediate]);

  // One button for noisy rooms and phones: interrupt Chikki, start listening, or send right now.
  const handleTapToTalk = useCallback(() => {
    if (liveTranscriptRef.current && !audioQueue.isPlaying) {
      finishNow?.();
      return;
    }
    activeTurnIdRef.current = null;
    stopAudioImmediate();
    socketRef.current?.interrupt();
    unlockAudioContext();
    setChikkiState("listening");
    startListening?.();
  }, [finishNow, startListening, stopAudioImmediate]);

  const handleSwitchToChat = useCallback(() => {
    stopAudioImmediate();
    socketRef.current?.interrupt();
    setInputMode("chat");
    setShowTypeSuggestion(false);
    if (!active) setActive(true);
  }, [active, stopAudioImmediate]);

  const handleSwitchToVoice = useCallback(() => {
    returnToVoiceHome();
  }, [returnToVoiceHome]);

  useEffect(() => {
    if (active && inputMode === "chat" && sharedPendingRef.current) {
      const question = sharedPendingRef.current;
      sharedPendingRef.current = null;
      handleChatSend(question);
    }
  }, [active, inputMode, handleChatSend]);

  useEffect(() => {
    if (!supported) setMicError(true);
  }, [supported]);

  useEffect(() => {
    if (!active) return;

    socketReadyRef.current = false;

    socketRef.current = connectVoiceSocket({
      onMood: (mood, turnId) => {
        if (turnId !== activeTurnIdRef.current) return;
        turnMoodRef.current = mood;
        replyExpressionRef.current = expressionForTurn(mood, "");
        setVoiceExpression(replyExpressionRef.current);
      },
      onOpen: () => {
        window.clearTimeout(lostTimerRef.current);
        setSocketLost(false);
        socketReadyRef.current = true;
        if (inputModeRef.current === "voice") setChikkiState("listening");

        const syncedHistory = messagesRef.current
          .filter((message) => !message.isError && message.content?.trim())
          .map(({ role, content, history_content }) => ({
            role,
            content: history_content || content,
          }));
        const jokeHistory = [];
        let previousUserAskedForJoke = false;
        for (const message of messagesRef.current) {
          if (message.role === "user") {
            previousUserAskedForJoke = isJokeRequest(message.content);
          } else if (message.role === "assistant") {
            const joke = message.history_content || message.content;
            if (joke?.trim() && (message.kind === "joke" || previousUserAskedForJoke)) {
              jokeHistory.push(joke.trim());
            }
            previousUserAskedForJoke = false;
          }
        }
        const pendingMessage = pendingMessageRef.current;
        const lastSyncedMessage = syncedHistory[syncedHistory.length - 1];
        if (
          pendingMessage &&
          lastSyncedMessage?.role === "user" &&
          lastSyncedMessage.content === pendingMessage.text
        ) {
          syncedHistory.pop();
        }

        if (syncedHistory.length > 0 || jokeHistory.length > 0) {
          socketRef.current?.sync(syncedHistory, jokeHistory);
        }

        if (pendingMessage) {
          const { text, voice, language, turnId } = pendingMessage;
          socketRef.current?.send(text, { voice, session_id: sessionId, language, turn_id: turnId });
          pendingMessageRef.current = null;
        }
      },

      onDelta: (text, tid, turnId) => {
        if (turnId !== activeTurnIdRef.current) return;
        if (tid) {
          setCurrentTraceId(tid);
        }
        // In text chat the reply is shown as it is written. Voice mode reveals it in step with the audio instead.
        if (inputModeRef.current === "voice" || !text) return;
        setMessages((prev) => {
          const copy = [...prev];
          const index = copy.findIndex((message) => message.role === "assistant" && message.turn_id === turnId);
          if (index >= 0 && !copy[index].final) {
            copy[index] = { ...copy[index], content: `${copy[index].content || ""}${text}`, isStreaming: true };
          }
          return copy;
        });
      },

      onAudioChunk: (data, mime, _tone, tid) => {
        const turnId = typeof data === "object" ? data.turn_id : null;
        if (turnId !== activeTurnIdRef.current) return;
        if (tid) {
          setCurrentTraceId(tid);
        }

        const rawData = typeof data === "object" ? data.data : data;
        const mimeType = (typeof data === "object" ? data.mime : mime) || "audio/mpeg";
        const chunkText = (typeof data === "object" ? data.text : "") || "";

        if (!rawData) return;
        if (!receivedAudioForTurnRef.current && voiceTurnStartRef.current !== null) {
          sendVoiceMetric("ok", Math.round(performance.now() - voiceTurnStartRef.current), currentLangRef.current);
          voiceTurnStartRef.current = null;
        }
        if (!receivedAudioForTurnRef.current) {
          setTapAssist(false);
          playChime("done");
        }
        receivedAudioForTurnRef.current = true;

        const audioSrc = `data:${mimeType};base64,${rawData}`;
        audioQueue.enqueue(audioSrc, chunkText, turnId);
      },

      onText: (reply, meta) => {
        if (meta?.turn_id !== activeTurnIdRef.current) return;
        const tid = meta?.trace_id;
        if (tid) {
          setCurrentTraceId(tid);
        }
        setChatThinking(false);

        // Fallback: backend sent text but no audio (e.g. edge-tts blocked),
        // so speak the reply with the browser's built-in voice instead.
        if (
          inputModeRef.current === "voice" &&
          !receivedAudioForTurnRef.current &&
          !meta?.isError &&
          reply?.trim()
        ) {
          const fallbackExpression = expressionForTurn(meta?.mood || turnMoodRef.current, reply);
          replyExpressionRef.current = fallbackExpression;
          setVoiceExpression(fallbackExpression);
          sendVoiceMetric("tts_fallback", null, currentLangRef.current);
          voiceTurnStartRef.current = null;
          setTapAssist(true);
          speakWithBrowser(reply, currentLangRef.current, {
            onUnavailable: () => {
              sendVoiceMetric("text_only", null, currentLangRef.current);
              setVoiceNotice("Voice isn't available right now, so the answer is shown as text.");
              if (voiceNoticeTimerRef.current) window.clearTimeout(voiceNoticeTimerRef.current);
              voiceNoticeTimerRef.current = window.setTimeout(() => setVoiceNotice(""), 8000);
            },
            onStart: () => {
              setIsAssistantSpeaking(true);
              setChikkiState("speaking");
            },
            onEnd: () => {
              setIsAssistantSpeaking(false);
              setChikkiState(fallbackExpression);
              if (expressionHoldTimerRef.current) window.clearTimeout(expressionHoldTimerRef.current);
              expressionHoldTimerRef.current = window.setTimeout(
                () => setChikkiState("listening"),
                EXPRESSION_HOLD_MS
              );
            },
          });
        }

        setMessages((prev) => {
          const copy = [...prev];
          const hasPacedAudio = inputModeRef.current === "voice" && receivedAudioForTurnRef.current;
          const turnIndex = copy.findIndex(
            (message) => message.role === "assistant" && message.turn_id === meta.turn_id
          );
          if (turnIndex < 0) return copy;
          copy[turnIndex] = {
            ...copy[turnIndex],
            content: hasPacedAudio ? copy[turnIndex].content : reply,
            history_content: reply,
            final: true,
            isStreaming: false,
            verified: Boolean(meta?.verified),
            isError: meta?.isError,
            kind: meta?.kind,
            sources: meta?.sources || [],
            actions: meta?.actions || [],
            trace_id: tid || currentTraceIdRef.current,
          };
          if (!hasPacedAudio) {
            const expression = expressionForTurn(meta?.mood || turnMoodRef.current, reply);
            replyExpressionRef.current = expression;
            setVoiceExpression(expression);
          }
          return copy;
        });

        if (inputModeRef.current !== "voice" && !meta?.isError) {
          playChime("done");
          buzz([12, 40, 12]);
        }
        setFollowUpSuggestions(meta?.suggestions?.length ? meta.suggestions : suggestionsForReply(reply));
      },

      onError: () => {
        setChatThinking(false);
        setChikkiState("error");
      },

      onClose: () => {
        socketReadyRef.current = false;
        window.clearTimeout(lostTimerRef.current);
        lostTimerRef.current = window.setTimeout(() => setSocketLost(true), 3500);
      },
    });

    return () => {
      if (expressionHoldTimerRef.current) window.clearTimeout(expressionHoldTimerRef.current);
      socketReadyRef.current = false;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [active, sessionId]);

  if (micError && inputMode !== "chat") {
    return (
      <div className="min-h-screen dot-grid flex flex-col items-center justify-center text-center px-6 font-mono">
        <p className="text-chikki-purpleLight mb-4 text-sm">
          Voice isn&apos;t available in this browser.
        </p>
        <button
          onClick={handleSwitchToChat}
          className="action-button primary-action text-xs"
        >
          Switch to text chat
        </button>
      </div>
    );
  }

  // Standby Screen Barrier (Click to Enable Microphone)
  if (!active) {
    return (
      <>
        <StandbyScreen
          state={chikkiState}
          onEnableMic={handleEnableMic}
          onActivate={handleWake}
          onTypeInstead={handleSwitchToChat}
          onDownloadResume={handleDownloadResume}
          onOpenContact={openContact}
          sharedLabel={sharedLink?.label}
          serverState={serverState}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <ContactModal
          isOpen={showContact}
          onClose={closeContact}
          onSent={handleContactSent}
          topics=""
          bookingUrl={CONTACT_ACTIONS.booking}
        />
      </>
    );
  }

  if (inputMode === "chat") {
    return (
      <>
        <ConnectionBanner offline={offline} lost={socketLost} onContact={openContact} />
        <ChatPanel
          messages={messages}
          onSend={handleChatSend}
          thinking={chatThinking}
          suggestions={followUpSuggestions}
          actions={CONTACT_ACTIONS}
          onReturnHome={returnToVoiceHome}
          onFeedback={handleFeedback}
          onDownloadResume={handleDownloadResume}
          onBack={handleSwitchToVoice}
          onOpenDashboard={() => setShowDashboard(true)}
          onOpenContact={openContact}
          onOpenMatch={openMatch}
          onShare={handleShare}
          onOpenHow={openHow}
          onOpenProjects={openProjects}
          onOpenSettings={openSettings}
          onOpenShortcuts={openShortcuts}
          onOpenInterview={openInterview}
          interview={interview}
          onInterviewNext={interviewNext}
          onInterviewEnd={interviewEnd}
          adminUi={adminUi}
          theme={theme}
          onToggleTheme={toggleTheme}
          onClear={handleClearChat}
          onOpenBooking={CONTACT_ACTIONS.booking ? () => window.open(CONTACT_ACTIONS.booking, "_blank", "noopener") : null}
          language={currentLang}
          onLanguageChange={setCurrentLang}
          onOpenRecap={openRecap}
          chikkiState={idleLook || (chatThinking ? "thinking" : messages.some((m) => m.role === "assistant" && m.final) ? voiceExpression : "idle")}
          chikkiExpression={voiceExpression}
        />
        <FeedbackDashboard
          isOpen={showDashboard}
          onClose={handleCloseDashboard}
        />
        <ContactModal
          isOpen={showContact}
          onClose={closeContact}
          onSent={handleContactSent}
          topics={resumeFocusFromMessages(messages).slice(0, 300)}
          bookingUrl={CONTACT_ACTIONS.booking}
        />
        <JobMatchModal isOpen={showMatch} onClose={closeMatch} onDownloadResume={handleDownloadTailoredResume} />
        <HowItWorksModal isOpen={showHow} onClose={closeHow} githubUrl={CONTACT_ACTIONS.github} />
        <ProjectsModal isOpen={showProjects} onClose={closeProjects} githubUrl={CONTACT_ACTIONS.github} />
        <SettingsModal isOpen={showSettings} onClose={closeSettings} onChange={setPrefs} />
        <ShortcutsModal isOpen={showShortcuts} onClose={closeShortcuts} />
        <InterviewModal isOpen={showInterview} onClose={closeInterview} onStart={startInterview} />
        <RecapModal isOpen={showRecap} onClose={closeRecap} messages={messages} />
      </>
    );
  }

  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  liveTranscriptRef.current = liveTranscript;
  const hasVoiceAnswer = Boolean(latestAssistant?.final && !latestAssistant?.isError && latestAssistant?.content?.trim());
  const currentPrompts = QUICK_PROMPTS[currentLang] || QUICK_PROMPTS["en-IN"];

  return (
    <div className="view-fade fit-viewport dot-grid px-4 py-4 sm:px-8 sm:py-5 flex flex-col font-mono">
      <ConnectionBanner offline={offline} lost={socketLost} onContact={openContact} />
      <div className="app-shell flex min-h-0 flex-1 flex-col w-full">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-lg tracking-[0.18em] font-bold text-chikki-purpleLight">CHIKKI</h1>
            <ProfileLine />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <LanguageSelector language={currentLang} onChange={setCurrentLang} />
            {/* Owner-only: reveal with ?admin=1 or Ctrl+Shift+A */}
            {adminUi && (
              <button
                type="button"
                onClick={() => setShowDashboard(true)}
                className="action-button text-[11px] border-indigo-900/40 bg-indigo-950/20 text-indigo-300 hover:bg-indigo-900/30"
                title="Open Feedback Analytics Dashboard"
              >
                📊 Analytics
              </button>
            )}

            <button
              onClick={handleSwitchToChat}
              className="action-button text-[11px]"
            >
              💬 Text
            </button>
          </div>
        </header>

        {/* Center Stage */}
        <main className="fit-main flex-1 py-3 text-center">
          <div className="fit-inner">
          <p className="fit-hide-short mb-2 text-[10px] uppercase tracking-[0.22em] text-gray-500">Ask about Akash</p>

          <div
            className="chikki-stage fit-stage cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={chikkiState === "speaking" ? "Stop Chikki speaking" : "Interact with Chikki"}
            title="Hover to make Chikki chuckle and wave; click to stop speech"
            onClick={() => {
              stopAudioImmediate();
              socketRef.current?.interrupt();
              setChikkiState("listening");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                stopAudioImmediate();
                socketRef.current?.interrupt();
                setChikkiState("listening");
              }
            }}
          >
            <ChikkiBot state={faceState} expression={voiceExpression} className="fit-svg" />
          </div>

          {/* Subtitles & State Readout */}
          <div className="mt-3 flex flex-col items-center gap-1.5 max-w-lg px-4 w-full">
            {liveTranscript && chikkiState !== "speaking" && chikkiState !== "thinking" ? (
              <div className="flex flex-col items-center gap-1 animate-fadeIn" aria-live="polite">
                <span className="text-[10px] uppercase tracking-wider text-chikki-purpleLight font-semibold">👂 I&apos;m hearing</span>
                <p className="text-xs sm:text-sm text-gray-300 italic">&ldquo;{liveTranscript}&rdquo;</p>
              </div>
            ) : voiceNotice && chikkiState !== "speaking" && chikkiState !== "thinking" ? (
              <p className="text-xs sm:text-sm text-amber-200" role="status">{voiceNotice}</p>
            ) : chikkiState === "speaking" && latestAssistant ? (
              <div className="flex flex-col items-center gap-1 animate-fadeIn">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">🤖 Chikki</span>
                <p className="text-xs sm:text-sm text-gray-200 line-clamp-3 leading-relaxed">
                  &ldquo;{latestAssistant.content}&rdquo;
                </p>
              </div>
            ) : latestUser && (chikkiState === "thinking" || chikkiState === "curious") ? (
              <div className="flex flex-col items-center gap-1 animate-fadeIn">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">👤 You</span>
                <p className="text-xs sm:text-sm text-gray-300 italic">
                  &ldquo;{latestUser.content}&rdquo;
                </p>
              </div>
            ) : (
              <p key={chikkiState} aria-live="polite" className="fade-swap min-h-[1.5rem] text-sm text-gray-300">
                {chikkiState === "thinking"
                  ? <ThinkingWord />
                  : chikkiState === "error"
                  ? "Something went wrong."
                  : chikkiState === "wake"
                  ? "Waking up..."
                  : chikkiState === "greet"
                  ? "Hi! I'm Chikki."
                  : EXPRESSION_LABELS[chikkiState]?.[0] || "I'm listening..."}
              </p>
            )}
          </div>

          {(chikkiState === "listening" || (liveTranscript && chikkiState !== "speaking" && chikkiState !== "thinking")) && (
            <div className="mt-3">
              <ListeningWave hearing={Boolean(liveTranscript)} />
            </div>
          )}

          <p key={`label-${chikkiState}`} className="fade-swap mt-2 text-[10px] uppercase tracking-[0.18em] text-chikki-purpleLight font-semibold">
            {chikkiState === "thinking"
              ? <ThinkingWord />
              : chikkiState === "speaking"
              ? "Speaking (Tap bot to stop)"
              : chikkiState === "error"
              ? "Error"
              : chikkiState === "wake"
              ? "Waking"
              : chikkiState === "greet"
              ? "Ready"
              : EXPRESSION_LABELS[chikkiState]?.[1] || "Listening"}
          </p>

          {tapAssist && (
            <button
              type="button"
              onClick={handleTapToTalk}
              className="action-button mt-3 px-5 text-xs"
              title="Tap to talk, interrupt Chikki, or send what you have said"
            >
              {liveTranscript && chikkiState !== "speaking"
                ? "✅ Done, send it"
                : chikkiState === "speaking"
                ? "✋ Tap to interrupt"
                : "🎤 Tap to talk"}
            </button>
          )}

          {prefs.transcript && messages.some((m) => m.content?.trim()) && (
            <details className="mt-3 w-full max-w-lg text-left">
              <summary className="cursor-pointer select-none text-center text-[11px] text-gray-500 hover:text-chikki-purpleLight">📝 Transcript</summary>
              <div className="chikki-scroll mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-800 bg-zinc-900/40 p-3 text-xs">
                {messages.filter((m) => m.content?.trim()).slice(-8).map((m, i) => (
                  <p key={i} className={m.role === "user" ? "text-gray-300" : "text-gray-200"}>
                    <span className="mr-1.5 text-[10px] uppercase tracking-wider text-gray-500">{m.role === "user" ? "You" : "Chikki"}</span>
                    {plainText(m.history_content || m.content)}
                  </p>
                ))}
              </div>
            </details>
          )}

          {debugVoice && (
            <pre className="mt-3 max-h-40 w-full max-w-lg overflow-auto rounded border border-gray-700 bg-black/60 p-2 text-left text-[10px] text-green-300">
              {voiceLogLines().join("\n") || "voice log is empty: nothing heard yet"}
            </pre>
          )}

          {/* Suggestion Rail */}
          <div className="suggestion-rail fit-hide-tiny mt-3 w-full max-w-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Try asking</span>
              <span className="text-[10px] text-gray-600">or say it aloud</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[...followUpSuggestions, ...currentPrompts].slice(0, 4).map((prompt, index) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleResult(prompt)}
                  disabled={chikkiState === "thinking"}
                  className={`prompt-button hover:border-chikki-purple hover:text-chikki-purpleLight disabled:opacity-40 ${index >= 2 ? "chip-fit-extra" : ""}`}
                >
                  <span className="text-chikki-purpleLight mr-2">›</span> {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Bar */}
          <div className={`mt-2 flex flex-col items-center gap-2 ${hasVoiceAnswer ? "" : "hidden"}`}>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span>Was that helpful?</span>
              <button
                type="button"
                onClick={() => handleVoiceVote("helpful")}
                className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                  voiceFeedbackVote === "helpful"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "hover:text-chikki-green"
                }`}
              >
                👍 Like
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => handleVoiceVote("needs-improvement")}
                className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                  voiceFeedbackVote === "needs-improvement"
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    : "hover:text-red-400"
                }`}
              >
                👎 Dislike
              </button>
            </div>

            {showVoiceCommentBox && (
              <div className="mt-1 p-2.5 rounded-lg border border-gray-800 bg-zinc-900/90 w-full max-w-sm text-left">
                {voiceFeedbackSaved ? (
                  <p className="text-[11px] text-emerald-400 font-medium text-center">
                    ✓ Feedback saved! Thank you.
                  </p>
                ) : (
                  <form onSubmit={handleVoiceCommentSubmit} className="flex flex-col gap-1.5">
                    <textarea
                      rows={2}
                      value={voiceComment}
                      onChange={(e) => setVoiceComment(e.target.value)}
                      placeholder="Add detailed feedback (optional)..."
                      className="w-full rounded border border-gray-700 bg-zinc-950 p-2 text-[11px] text-gray-200 outline-none focus:border-chikki-purple resize-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowVoiceCommentBox(false)}
                        className="px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200"
                      >
                        Skip
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded bg-chikki-purple/30 border border-chikki-purple text-chikki-purpleLight text-[10px] font-semibold hover:bg-chikki-purple/40"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {showTypeSuggestion && (
            <p className="mt-3 text-xs text-gray-500">
              Having trouble hearing you?{" "}
              <button
                onClick={handleSwitchToChat}
                className="text-chikki-purpleLight underline underline-offset-4"
              >
                Use text chat
              </button>
            </p>
          )}

          {/* Links */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <button type="button" onClick={handleDownloadResume} className="action-button primary-action">
              📄 Resume PDF
            </button>
            <button type="button" onClick={openContact} className="action-button primary-action">
              ✉️ Contact Akash
            </button>
            <button type="button" onClick={openMatch} className="action-button">
              🎯 Check role fit
            </button>
            <MoreMenu
              direction="up"
              items={[
                { key: "projects", label: "🗂️ Projects", onClick: openProjects },
                { key: "settings", label: "⚙️ Settings", onClick: openSettings },
                { key: "shortcuts", label: "⌨️ Keyboard shortcuts", onClick: openShortcuts },
                { key: "interview", label: "🎤 Interview mode", onClick: openInterview },
                messages.some((m) => m.role === "user") && { key: "recap", label: "📝 Summarise our chat", onClick: openRecap },
                { key: "how", label: "🧠 How Chikki works", onClick: openHow },
                canCall && CONTACT_ACTIONS.phone && { key: "call", label: "📞 Call Akash", href: telHref(CONTACT_ACTIONS.phone) },
                CONTACT_ACTIONS.linkedin && { key: "linkedin", label: "💼 LinkedIn", href: CONTACT_ACTIONS.linkedin },
                CONTACT_ACTIONS.github && { key: "github", label: "💻 GitHub", href: CONTACT_ACTIONS.github },
                { key: "theme", label: theme === "light" ? "🌙 Dark theme" : "☀️ Light theme", onClick: toggleTheme },
              ]}
            />
          </div>
          </div>
        </main>

        <div className="fit-hide-short fit-hide-mid"><AppFooter /></div>
      </div>

      <FeedbackDashboard
        isOpen={showDashboard}
        onClose={handleCloseDashboard}
      />
      <ContactModal
        isOpen={showContact}
        onClose={closeContact}
        onSent={handleContactSent}
        topics={resumeFocusFromMessages(messages).slice(0, 300)}
        bookingUrl={CONTACT_ACTIONS.booking}
      />
      <JobMatchModal isOpen={showMatch} onClose={closeMatch} onDownloadResume={handleDownloadTailoredResume} />
      <HowItWorksModal isOpen={showHow} onClose={closeHow} githubUrl={CONTACT_ACTIONS.github} />
      <ProjectsModal isOpen={showProjects} onClose={closeProjects} githubUrl={CONTACT_ACTIONS.github} />
      <SettingsModal isOpen={showSettings} onClose={closeSettings} onChange={setPrefs} />
      <InterviewModal isOpen={showInterview} onClose={closeInterview} onStart={startInterview} />
      <RecapModal isOpen={showRecap} onClose={closeRecap} messages={messages} />
    </div>
  );
}