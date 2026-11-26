import { useEffect, useRef, useState, useCallback } from "react";
import { correctTranscript, isLowConfidence } from "../speechText.js";
import { transcribeAudio } from "../services/api.js";

const SERVER_STT = import.meta.env.VITE_SERVER_STT !== "false";
const MIN_AUDIO_BYTES = 1500;

export function useSpeechRecognition({
  mode = "wake", // "wake" | "command" | "off"
  lang = "en-IN",
  isAssistantSpeaking = false,
  onWake,
  onResult,
  onInterim,
  onUnclear,
  onSpeechError,
}) {
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const speechBufferRef = useRef("");
  const lowConfidenceRef = useRef(false);

  const modeRef = useRef(mode);
  const langRef = useRef(lang);
  const previousLangRef = useRef(lang);
  const isSpeakingRef = useRef(isAssistantSpeaking);

  modeRef.current = mode;
  langRef.current = lang;
  isSpeakingRef.current = isAssistantSpeaking;

  const callbacksRef = useRef({ onWake, onResult, onInterim, onUnclear, onSpeechError });
  callbacksRef.current = { onWake, onResult, onInterim, onUnclear, onSpeechError };

  // Records the visitor's voice so the server can transcribe it accurately. The browser
  // recogniser still runs for live captions and as the fallback if the server is unreachable.
  const recorderRef = useRef({ stream: null, recorder: null, chunks: [], broken: false, startedAt: 0 });
  const utteranceActiveRef = useRef(false);

  const startRecorder = useCallback(async () => {
    const state = recorderRef.current;
    if (!SERVER_STT || state.broken || state.recorder || typeof MediaRecorder === "undefined") return;
    try {
      if (!state.stream || state.stream.getTracks().every((t) => t.readyState === "ended")) {
        state.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
      }
      const recorder = new MediaRecorder(state.stream);
      state.chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) state.chunks.push(event.data);
      };
      recorder.start(250);
      state.recorder = recorder;
      state.startedAt = Date.now();
    } catch {
      state.broken = true; // mic cannot be shared on this device; keep the browser transcript
      state.recorder = null;
    }
  }, []);

  // Stops recording and returns the clip (or null). Pass keep=false to discard it.
  const stopRecorder = useCallback((keep = true) => {
    const state = recorderRef.current;
    const recorder = state.recorder;
    if (!recorder) return Promise.resolve(null);
    state.recorder = null;
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = keep && state.chunks.length ? new Blob(state.chunks, { type: recorder.mimeType || "audio/webm" }) : null;
        state.chunks = [];
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const releaseMic = useCallback(() => {
    stopRecorder(false);
    const state = recorderRef.current;
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }, [stopRecorder]);

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

  const dispatchCommand = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const browserText = correctTranscript(
      speechBufferRef.current.replace(/^(hey\s+)?chikk[iy]\s*/i, "")
    );
    const unclear = lowConfidenceRef.current;
    speechBufferRef.current = "";
    lowConfidenceRef.current = false;
    utteranceActiveRef.current = false;

    // Take the recording of this utterance and start a fresh one right away.
    const clip = await stopRecorder(true);
    if (modeRef.current === "command" && !isSpeakingRef.current) startRecorder();

    if (!browserText || browserText.length <= 2) return;

    let text = browserText;
    let confident = !unclear;
    if (clip && clip.size >= MIN_AUDIO_BYTES) {
      const server = await transcribeAudio(clip, langRef.current);
      if (server) {
        // The server answered: trust it over the browser, including when it heard nothing real.
        if (!server.text) return;
        text = correctTranscript(server.text.replace(/^(hey\s+)?chikk[iy]\s*/i, ""));
        confident = server.confident;
      }
    }
    if (!text || text.length <= 2) return;
    if (!confident) {
      callbacksRef.current.onUnclear?.(text);
      return;
    }
    callbacksRef.current.onResult?.(text);
  }, [startRecorder, stopRecorder]);

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
      recognition.maxAlternatives = 3;
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
          const result = event.results[i];
          // Prefer the alternative the recogniser is most confident about.
          let best = result[0];
          for (let a = 1; a < result.length; a += 1) {
            if ((result[a]?.confidence || 0) > (best?.confidence || 0) + 0.15) best = result[a];
          }
          const transcript = best?.transcript || "";
          if (result.isFinal) {
            finalText += transcript;
            if (isLowConfidence(best?.confidence)) lowConfidenceRef.current = true;
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
          utteranceActiveRef.current = true;
          const recognizedText = (
            speechBufferRef.current +
            " " +
            currentSegment
          ).trim();
          callbacksRef.current.onInterim?.(correctTranscript(recognizedText));

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
          }, finalText ? 800 : 1600);
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
      lowConfidenceRef.current = false;
      utteranceActiveRef.current = false;
      stopRecorder(false);
      try {
        recognitionRef.current?.abort();
      } catch (_) {}
      isListeningRef.current = false;
    } else {
      const timer = setTimeout(() => {
        if (modeRef.current !== "off") {
          startListening();
          if (modeRef.current === "command") startRecorder();
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isAssistantSpeaking, startListening, startRecorder, stopRecorder]);

  useEffect(() => {
    initHardwareDSP();
  }, [initHardwareDSP]);

  useEffect(() => {
    if (previousLangRef.current !== lang) {
      speechBufferRef.current = "";
      lowConfidenceRef.current = false;
      previousLangRef.current = lang;
    }
  }, [lang]);

  useEffect(() => {
    if (mode === "off") {
      stopRecognition();
      releaseMic();
    } else {
      startListening();
      if (mode === "command") startRecorder();
      else stopRecorder(false);
    }

    return () => {
      stopRecognition();
    };
  }, [mode, lang, startListening, stopRecognition, startRecorder, stopRecorder, releaseMic]);

  // Keep the clip short: if nobody has spoken for a while, start a fresh recording.
  useEffect(() => {
    if (mode !== "command") return undefined;
    const timer = setInterval(async () => {
      const state = recorderRef.current;
      if (state.recorder && !utteranceActiveRef.current && Date.now() - state.startedAt > 12000) {
        await stopRecorder(false);
        if (modeRef.current === "command" && !isSpeakingRef.current) startRecorder();
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [mode, startRecorder, stopRecorder]);

  useEffect(() => releaseMic, [releaseMic]);

  return { supported, startListening, stopRecognition };
}