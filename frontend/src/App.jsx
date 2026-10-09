import { useCallback, useEffect, useRef, useState } from "react";
import ChikkiBot from "./components/ChikkiBot.jsx";
import StandbyScreen from "./components/StandbyScreen.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import AppFooter from "./components/AppFooter.jsx";
import FeedbackDashboard from "./components/FeedbackDashboard.jsx";
import LanguageSelector from "./components/LanguageSelector.jsx";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition.js";
import { connectVoiceSocket, downloadResumePdf, fetchGreetingAudio, sendFeedback } from "./services/api.js";

const NO_SPEECH_FALLBACK_THRESHOLD = 3;
const CHAT_HISTORY_KEY = "chikki_chat_history";
const EXPRESSION_HOLD_MS = 3000;

function createTurnId() {
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isJokeRequest(text = "") {
  return /\b(joke|funny|make me laugh|crack me up)\b|జోక్|నవ్వు|चुटकुला|चुटकुले|जोक|हंसाओ|मज़ेदार/i.test(text);
}

function resumeFocusFromMessages(messages) {
  const ignoredTerms = new Set([
    "about", "akash", "and", "can", "could", "from", "have", "help", "his",
    "how", "into", "more", "please", "should", "tell", "that", "the", "this",
    "what", "when", "where", "which", "with", "would", "మీకు", "నాకు", "और", "क्यों",
  ]);
  const terms = messages
    .filter((message) => message.role === "user")
    .slice(-5)
    .flatMap((message) => message.content.match(/[\p{L}\p{N}+#.-]+/gu) || [])
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !ignoredTerms.has(term.toLowerCase()));
  return [...new Set(terms)].slice(-16).join(" ").slice(-240);
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
  email: import.meta.env.VITE_CONTACT_EMAIL || "akashbhalshankar07@gmail.com",
  phone: import.meta.env.VITE_CONTACT_PHONE || "+91 9014160774",
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
  determined: ["I’ll work through it.", "DETERMINED"],
  shy: ["Aww, that's kind of you!", "SHY"],
  joyful: ["That makes me so happy!", "JOYFUL"],
  laughing: ["Haha! That got me.", "LAUGHING"],
};

function expressionForReply(reply = "") {
  const text = reply.toLowerCase();
  if (/\b(hmm|let me think|well\.\.\.|ఆలోచిస్తున్నాను|सोच रही)\b/.test(text)) return "focused";
  if (/\b(laugh|funny|joke|hilarious|haha|hehe|lol|chuckle|నవ్వు|హాహా|हंस|जोक)\b/.test(text)) return "laughing";
  if (/\b(shy|blush|sweet|aww|thank you|compliment|kind of you|సిగ్గు|ధన్యవాదాలు|शुक्रिया|धन्यवाद)\b/.test(text)) return "shy";
  if (/\b(excited|amazing|incredible|fantastic|brilliant|thrilled|super cool|బాగుంది|बढ़िया)\b/.test(text)) return "excited";
  if (/\b(love|lovely|heartfelt|adorable)\b/.test(text)) return "love";
  if (/\b(surpris(e|d|ing)|wow|unexpected)\b/.test(text)) return "surprised";
  if (/\b(why should|strengths|expert|hire|confident|impact|fastapi|langgraph|ఎందుకు|क्यों)\b/.test(text)) return "confident";
  return "confident";
}

function expressionForUserInput(input = "") {
  const text = input.toLowerCase().trim();
  if (/^(hi|hello|hey|good morning|namaskaram|namaste|నమస్కారం|नमस्ते)\b/.test(text)) return "greet";
  if (/\b(joke|funny|play|game|haha|lol|జోక్|जोक)\b/.test(text)) return "playful";
  if (/\b(laugh|hilarious)\b/.test(text)) return "laughing";
  if (/\?$|\b(why|how|what|when|where|who|which|can you explain|ఎలా|ఏమిటి|कैसे|क्या)\b/.test(text)) return "curious";
  if (/\b(thank|thanks|appreciate|love|cute|pretty|sweet|ధన్యవాదాలు|शुक्रिया)\b/.test(text)) return "shy";
  if (/^(yes|yeah|yep|okay|ok|sure|let's|lets|సరే|हाँ|ठीक)\b/.test(text)) return "encouraging";
  if (/\b(help|stuck|confused|don't understand|cannot|can't|సహాయం|मदद)\b/.test(text)) return "concerned";
  return "curious";
}

function loadStoredMessages() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

// Global Audio Queue
const audioQueue = {
  queue: [],
  isPlaying: false,
  currentAudio: null,
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
      if (wordCount > 0) {
        revealedWordCount = 1;
        this.onPlayChunk?.(item.text, 1 / wordCount, item.turnId);
      }
      this.progressFrame = requestAnimationFrame(updateSubtitle);
    };

    audio.onended = () => {
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
    if (this.onPlayStateChange) this.onPlayStateChange(false);
    if (this.onQueueEmpty) this.onQueueEmpty();
  },
};
export default function App() {
  const [active, setActive] = useState(false);
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

  // Session tracking
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem("chikki_session_id");
    if (!sid) {
      sid = "sess_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
      sessionStorage.setItem("chikki_session_id", sid);
    }
    return sid;
  });

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
        const expression = expressionForReply(currentReply);
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

  const suggestionsForReply = (reply) => {
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

  const unlockAudioContext = () => {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      audio.play().catch(() => {});
    } catch (_) {}
  };

  const stopAudioImmediate = useCallback(() => {
    audioQueue.stopAll();
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
        const audioUrl = await fetchGreetingAudio(greeting, currentLangRef.current);
        setChikkiState("speaking");

        const audio = new Audio(audioUrl);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setChikkiState("listening");
        };
        await audio.play();
      } catch {
        setChikkiState("listening");
      }
    }, 250);
  }, [stopAudioImmediate]);

  const handleInterimSpeech = useCallback((interimText) => {
    if (!interimText) return;

    // While Chikki is actively speaking, ignore single noise clicks and faint bleed
    if (audioQueue.isPlaying || isAssistantSpeaking) {
      const trimmed = interimText.trim().toLowerCase();
      const words = trimmed.split(/\s+/).filter(Boolean);
      const isStopWord = /^(stop|wait|hold on|pause|listen|chikki|quiet|ఆగు|ఆపండి|రుకో|रुको|चुप)/i.test(trimmed);

      // Only interrupt if the user explicitly says a stop command OR a real phrase (>= 3 words)
      if (isStopWord || words.length >= 3) {
        activeTurnIdRef.current = null;
        stopAudioImmediate();
        socketRef.current?.interrupt();
        if (inputModeRef.current === "voice") setChikkiState("listening");
      }
      return;
    }

    if (activeTurnIdRef.current || audioQueue.queue.length > 0) {
      activeTurnIdRef.current = null;
      stopAudioImmediate();
      socketRef.current?.interrupt();
      if (inputModeRef.current === "voice") setChikkiState("listening");
    }
  }, [stopAudioImmediate, isAssistantSpeaking]);

  const handleResult = useCallback((transcript) => {
    if (!transcript) return;

    const turnId = createTurnId();
    activeTurnIdRef.current = turnId;
    spokenTextRef.current = "";
    receivedAudioForTurnRef.current = false;
    stopAudioImmediate();
    socketRef.current?.interrupt();

    setShowVoiceCommentBox(false);
    setVoiceFeedbackVote(null);
    setVoiceFeedbackSaved(false);
    lastPromptRef.current = transcript;

    const userMessage = { role: "user", content: transcript, turn_id: turnId };
    const assistantMessage = { role: "assistant", content: "", turn_id: turnId, final: false };
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

    if (!socketRef.current || !socketReadyRef.current) {
      pendingMessageRef.current = { text: transcript, voice, language, turnId };
      setTimeout(() => setChikkiState("thinking"), 250);
      return;
    }

    const sent = socketRef.current.send(transcript, { voice, session_id: sessionId, language, turn_id: turnId });
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
    const userMessage = { role: "user", content: text, turn_id: turnId };
    const assistantMessage = { role: "assistant", content: "", turn_id: turnId, final: false };
    messagesRef.current = [...messagesRef.current, userMessage, assistantMessage];
    setMessages(messagesRef.current);
    resumeFocusRef.current = messagesRef.current
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join(" ");
    setChatThinking(true);
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

  const handleSpeechError = useCallback((kind) => {
    if (kind === "not-allowed" || kind === "audio-capture" || kind === "not-supported") {
      setInputMode("chat");
      if (!active) setActive(true);
      return;
    }

    if (kind === "no-speech") {
      noSpeechCountRef.current += 1;
      if (noSpeechCountRef.current >= NO_SPEECH_FALLBACK_THRESHOLD) {
        setShowTypeSuggestion(true);
      }
    }
  }, [active]);

  const handleResultWithReset = useCallback((transcript) => {
    noSpeechCountRef.current = 0;
    handleResult(transcript);
  }, [handleResult]);

  const { supported, startListening } = useSpeechRecognition({
    mode: inputMode === "chat" ? "off" : active ? "command" : "wake",
    lang: currentLang,
    isAssistantSpeaking,
    onWake: handleWake,
    onResult: handleResultWithReset,
    onInterim: handleInterimSpeech,
    onSpeechError: handleSpeechError,
  });

  const handleEnableMic = useCallback(() => {
    stopAudioImmediate();
    unlockAudioContext();
    setInputMode("voice");
    setActive(true);
    setChikkiState("listening");
    startListening?.();
  }, [startListening, stopAudioImmediate]);

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
    if (!supported) setMicError(true);
  }, [supported]);

  useEffect(() => {
    if (!active) return;

    socketReadyRef.current = false;

    socketRef.current = connectVoiceSocket({
      onOpen: () => {
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

      onDelta: (_text, tid, turnId) => {
        if (turnId !== activeTurnIdRef.current) return;
        if (tid) {
          setCurrentTraceId(tid);
        }
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
            isError: meta?.isError,
            kind: meta?.kind,
            trace_id: tid || currentTraceIdRef.current,
          };
          if (!hasPacedAudio) {
            const expression = expressionForReply(reply);
            replyExpressionRef.current = expression;
            setVoiceExpression(expression);
          }
          return copy;
        });

        setFollowUpSuggestions(suggestionsForReply(reply));
      },

      onError: () => {
        setChatThinking(false);
        setChikkiState("error");
      },

      onClose: () => {
        socketReadyRef.current = false;
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
      <StandbyScreen
        state={chikkiState}
        onEnableMic={handleEnableMic}
        onActivate={handleWake}
        onTypeInstead={handleSwitchToChat}
      />
    );
  }

  if (inputMode === "chat") {
    return (
      <>
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
          language={currentLang}
          onLanguageChange={setCurrentLang}
        />
        <FeedbackDashboard
          isOpen={showDashboard}
          onClose={handleCloseDashboard}
        />
      </>
    );
  }

  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const currentPrompts = QUICK_PROMPTS[currentLang] || QUICK_PROMPTS["en-IN"];

  return (
    <div className="app-viewport dot-grid px-4 py-5 sm:px-8 sm:py-6 flex flex-col justify-between font-mono">
      <div className="app-shell flex flex-1 flex-col justify-between w-full">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-lg tracking-[0.18em] font-bold text-chikki-purpleLight">CHIKKI</h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gray-500">Voice conversation</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <LanguageSelector language={currentLang} onChange={setCurrentLang} />
            {/* Telemetry Dashboard Button */}
            <button
              type="button"
              onClick={() => setShowDashboard(true)}
              className="action-button text-[11px] border-indigo-900/40 bg-indigo-950/20 text-indigo-300 hover:bg-indigo-900/30"
              title="Open Feedback Analytics Dashboard"
            >
              📊 Analytics
            </button>

            <button
              onClick={handleSwitchToChat}
              className="action-button text-[11px]"
            >
              💬 Text
            </button>
          </div>
        </header>

        {/* Center Stage */}
        <main className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-gray-500">Ask about Akash</p>

          <div
            className="chikki-stage cursor-pointer"
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
            <ChikkiBot state={chikkiState} expression={voiceExpression} size={220} />
          </div>

          {/* Subtitles & State Readout */}
          <div className="mt-4 flex flex-col items-center gap-1.5 max-w-lg px-4 w-full">
            {chikkiState === "speaking" && latestAssistant ? (
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
              <p className="min-h-[1.5rem] text-sm text-gray-300">
                {chikkiState === "thinking"
                  ? "Hmm... let me think..."
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

          <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-chikki-purpleLight font-semibold">
            {chikkiState === "thinking"
              ? "Thinking"
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

          {/* Suggestion Rail */}
          <div className="suggestion-rail mt-6 w-full max-w-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Try asking</span>
              <span className="text-[10px] text-gray-600">or say it aloud</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[...followUpSuggestions, ...currentPrompts].slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleResult(prompt)}
                  disabled={chikkiState === "thinking"}
                  className="prompt-button hover:border-chikki-purple hover:text-chikki-purpleLight disabled:opacity-40"
                >
                  <span className="text-chikki-purpleLight mr-2">›</span> {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Bar */}
          <div className="mt-4 flex flex-col items-center gap-2">
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
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleDownloadResume}
              className="action-button primary-action"
            >
              Resume PDF
            </button>
            {CONTACT_ACTIONS.linkedin && (
              <a
                href={CONTACT_ACTIONS.linkedin}
                target="_blank"
                rel="noreferrer"
                className="action-button"
              >
                LinkedIn
              </a>
            )}
            {CONTACT_ACTIONS.github && (
              <a href={CONTACT_ACTIONS.github} target="_blank" rel="noreferrer" className="action-button">
                GitHub
              </a>
            )}
            {CONTACT_ACTIONS.email && (
              <a
                href={`mailto:${CONTACT_ACTIONS.email}?subject=${encodeURIComponent("Interview opportunity for Akash Bhalshankar")}`}
                className="action-button primary-action"
              >
                Contact Akash
              </a>
            )}
            {CONTACT_ACTIONS.phone && (
              <a
                href={`tel:${CONTACT_ACTIONS.phone.replace(/\s+/g, "")}`}
                className="action-button"
              >
                Call
              </a>
            )}
          </div>
        </main>

        <AppFooter />
      </div>

      <FeedbackDashboard
        isOpen={showDashboard}
        onClose={handleCloseDashboard}
      />
    </div>
  );
}