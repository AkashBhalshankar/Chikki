import { useEffect, useRef, useState, useCallback } from "react";

export function useSpeechRecognition({
  mode = "wake", // "wake" | "command" | "off"
  lang = "en-IN",
  isAssistantSpeaking = false,
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
  const isSpeakingRef = useRef(isAssistantSpeaking);

  modeRef.current = mode;
  langRef.current = lang;
  isSpeakingRef.current = isAssistantSpeaking;

  const callbacksRef = useRef({ onWake, onResult, onInterim, onSpeechError });
  callbacksRef.current = { onWake, onResult, onInterim, onSpeechError };

  // Initialize mobile hardware DSP to isolate voice and stop tracks cleanly
  const initHardwareDSP = useCallback(async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true, // Kills phone speaker reflection
            noiseSuppression: true, // Mutes ambient room noise (fans, distant chatter)
            autoGainControl: false, // Prevents mic from auto-boosting background voices
          },
        });
        // Stop temporary tracks so Web Speech API has clean hardware access
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (_) {}
  }, []);

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
        recognitionRef.current.abort();
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
        // Shield: drop all incoming frames while Chikki is speaking
        if (isSpeakingRef.current) {
          speechBufferRef.current = "";
          return;
        }

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
          if (
            lower.includes("chikki") ||
            lower.includes("chiki") ||
            lower.includes("chikky")
          ) {
            callbacksRef.current.onWake?.();
          }
          return;
        }

        // In command mode
        if (modeRef.current === "command") {
          const recognizedText = (
            speechBufferRef.current +
            " " +
            currentSegment
          ).trim();
          callbacksRef.current.onInterim?.(recognizedText);

          if (finalText) {
            speechBufferRef.current = (
              speechBufferRef.current +
              " " +
              finalText
            ).trim();
          }

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (interimText && !finalText) {
              speechBufferRef.current = (
                speechBufferRef.current +
                " " +
                interimText
              ).trim();
            }
            dispatchCommand();
          }, 1800);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech") return;
        callbacksRef.current.onSpeechError?.(event.error);
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        // Only restart if not in "off" mode and assistant is not speaking
        if (modeRef.current !== "off" && !isSpeakingRef.current) {
          setTimeout(() => {
            if (
              modeRef.current !== "off" &&
              !isListeningRef.current &&
              !isSpeakingRef.current
            ) {
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

  // Manage speaking lifecycle: abort during TTS, resume with cooldown
  useEffect(() => {
    if (isAssistantSpeaking) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      speechBufferRef.current = "";
      try {
        recognitionRef.current?.abort();
      } catch (_) {}
      isListeningRef.current = false;
    } else {
      const timer = setTimeout(() => {
        if (modeRef.current !== "off") {
          startListening();
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isAssistantSpeaking, startListening]);

  useEffect(() => {
    initHardwareDSP();
  }, [initHardwareDSP]);

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