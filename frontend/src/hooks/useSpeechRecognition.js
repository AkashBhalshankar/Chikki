import { useEffect, useRef, useState, useCallback } from "react";

export function useSpeechRecognition({
  mode = "wake", // "wake" | "command" | "off"
  lang = "en-IN",
  onWake,
  onResult,
  onInterim,
  onSpeechError,
}) {
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const speechBufferRef = useRef("");

  const modeRef = useRef(mode);
  const langRef = useRef(lang);
  const previousLangRef = useRef(lang);
  modeRef.current = mode;
  langRef.current = lang;

  const callbacksRef = useRef({ onWake, onResult, onInterim, onSpeechError });
  callbacksRef.current = { onWake, onResult, onInterim, onSpeechError };

  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
  }, []);

  const dispatchCommand = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const clean = speechBufferRef.current
      .replace(/^(hey\s+)?chikk[iy]\s*/i, "")
      .trim();

    if (clean && clean.length > 2) {
      callbacksRef.current.onResult?.(clean);
      speechBufferRef.current = "";
    }
  }, []);

  const startListening = useCallback(() => {
    if (modeRef.current === "off") return;
    if (isListeningRef.current) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      callbacksRef.current.onSpeechError?.("not-supported");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langRef.current || "en-IN";

      recognition.onstart = () => {
        isListeningRef.current = true;
      };

      recognition.onresult = (event) => {
        let interimText = "";
        let finalText = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        const currentSegment = (finalText || interimText).trim();
        if (!currentSegment) return;

        // Wake word check
        if (modeRef.current === "wake") {
          const lower = currentSegment.toLowerCase();
          if (lower.includes("chikki") || lower.includes("chiki") || lower.includes("chikky")) {
            callbacksRef.current.onWake?.();
          }
          return;
        }

        // In command mode: accumulate speech and wait for true pause
        if (modeRef.current === "command") {
          const recognizedText = (speechBufferRef.current + " " + currentSegment).trim();
          callbacksRef.current.onInterim?.(recognizedText);

          if (finalText) {
            speechBufferRef.current = (speechBufferRef.current + " " + finalText).trim();
          }

          // Reset silence timer: wait a full 2.2 seconds of silence before committing
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (interimText && !finalText) {
              speechBufferRef.current = (speechBufferRef.current + " " + interimText).trim();
            }
            dispatchCommand();
          }, 2200); // 2.2s gives you comfortable breathing room to pause mid-sentence
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech") return;
        callbacksRef.current.onSpeechError?.(event.error);
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        // Do not die if user hasn't explicitly clicked Stop/Off
        if (modeRef.current !== "off") {
          setTimeout(() => {
            if (modeRef.current !== "off" && !isListeningRef.current) {
              try {
                recognition.start();
                isListeningRef.current = true;
              } catch (_) {}
            }
          }, 350);
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      isListeningRef.current = false;
    }
  }, [dispatchCommand]);

  useEffect(() => {
    if (previousLangRef.current !== lang) {
      speechBufferRef.current = "";
      previousLangRef.current = lang;
    }
  }, [lang]);

  useEffect(() => {
    if (mode === "off") {
      stopRecognition();
    } else {
      startListening();
    }

    return () => {
      stopRecognition();
    };
  }, [mode, lang, startListening, stopRecognition]);

  return { supported, startListening, stopRecognition };
}