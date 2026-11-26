import { useEffect, useRef, useState, useCallback } from "react";
import { correctTranscript, isLowConfidence } from "../speechText.js";
import { transcribeAudio } from "../services/api.js";
import { logVoice } from "../voiceLog.js";

const SERVER_STT = import.meta.env.VITE_SERVER_STT !== "false";
const MIN_AUDIO_BYTES = 1500;
const BARGE_IN = import.meta.env.VITE_BARGE_IN !== "false";

export function useSpeechRecognition({
  mode = "wake", // "wake" | "command" | "off"
  lang = "en-IN",
  isAssistantSpeaking = false,
  onWake,
  onResult,
  onInterim,
  onUnclear,
  onSpeechError,
  onServerSttFailed,
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

  const callbacksRef = useRef({ onWake, onResult, onInterim, onUnclear, onSpeechError, onServerSttFailed });
  callbacksRef.current = { onWake, onResult, onInterim, onUnclear, onSpeechError, onServerSttFailed };
  const lastHeardAtRef = useRef(0); // when the browser recogniser last produced any result
  const bargedRef = useRef(false); // the visitor started talking over Chikki, so the clip misses their first words

  // Records the visitor's voice so the server can transcribe it accurately. The browser
  // recogniser still runs for live captions and as the fallback if the server is unreachable.
  const recorderRef = useRef({ stream: null, recorder: null, chunks: [], broken: false, startedAt: 0, audioCtx: null, analyser: null });
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
      if (!state.analyser) {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          state.audioCtx = new Ctx();
          state.analyser = state.audioCtx.createAnalyser();
          state.analyser.fftSize = 512;
          state.audioCtx.createMediaStreamSource(state.stream).connect(state.analyser);
        } catch (_) {
          state.analyser = null; // no level meter; the safety check below simply stays off
        }
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
    try {
      state.audioCtx?.close();
    } catch (_) {}
    state.audioCtx = null;
    state.analyser = null;
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
    logVoice(`silence -> sending what was heard: "${speechBufferRef.current.trim()}"`);
    const browserText = correctTranscript(
      speechBufferRef.current.replace(/^(hey\s+)?chikk[iy]\s*/i, "")
    );
    const unclear = lowConfidenceRef.current;
    speechBufferRef.current = "";
    lowConfidenceRef.current = false;
    utteranceActiveRef.current = false;

    // Take the recording of this utterance and start a fresh one right away.
    // Every wait here is capped: a stuck recorder or a slow server must never swallow a question.
    const barged = bargedRef.current;
    bargedRef.current = false;
    const clip = await Promise.race([stopRecorder(true), new Promise((resolve) => setTimeout(() => resolve(null), 1500))]);
    if (modeRef.current === "command" && !isSpeakingRef.current) startRecorder();

    if (!browserText || browserText.length <= 2) return;

    let text = browserText;
    let confident = !unclear;
    if (clip && clip.size >= MIN_AUDIO_BYTES && !barged) {
      const server = await transcribeAudio(clip, langRef.current);
      if (!server) {
        callbacksRef.current.onServerSttFailed?.();
      } else if (server.text) {
        logVoice(`server heard: "${server.text}" (browser: "${browserText}")`);
        // The server is more accurate than the browser, so use its words when it has some.
        text = correctTranscript(server.text.replace(/^(hey\s+)?chikk[iy]\s*/i, ""));
        confident = server.confident || confident;
      }
      // When the server heard nothing (short phrases like "thank you" are often filtered as noise),
      // the browser's transcript still stands.
    }
    if (!text || text.length <= 2) return;
    if (!confident) {
      callbacksRef.current.onUnclear?.(text);
      return;
    }
    logVoice(`asking Chikki: "${text}"`);
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
        lastHeardAtRef.current = Date.now();
        // Shield: drop all incoming frames while Chikki is speaking
        if (isSpeakingRef.current) {
          speechBufferRef.current = "";
          if (BARGE_IN && modeRef.current === "command") {
            // Let the visitor interrupt: pass what was heard up; the page decides whether it is
            // really the visitor (not Chikki's own voice) and stops the speech.
            let heard = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) heard += event.results[i][0]?.transcript || "";
            if (heard.trim() && callbacksRef.current.onInterim?.(heard.trim(), true)) bargedRef.current = true;
          }
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
        logVoice(`${finalText ? "final" : "hearing"}: "${currentSegment}"`);

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
        logVoice(`recogniser error: ${event.error}`);
        callbacksRef.current.onSpeechError?.(event.error);
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        // Only restart if not in "off" mode and assistant is not speaking
        if (modeRef.current !== "off" && (!isSpeakingRef.current || BARGE_IN)) {
          setTimeout(() => {
            if (
              modeRef.current !== "off" &&
              !isListeningRef.current &&
              (!isSpeakingRef.current || BARGE_IN)
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
      if (!BARGE_IN) {
        try {
          recognitionRef.current?.abort();
        } catch (_) {}
        isListeningRef.current = false;
      }
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

  // Safety net: on some devices a second microphone stream starves the browser recogniser, so the
  // page sits on "listening" while the visitor talks. If the level meter hears speech for a few
  // seconds and the recogniser hears nothing, give up server transcription and let the recogniser
  // have the microphone to itself.
  useEffect(() => {
    if (mode !== "command") return undefined;
    let loudMs = 0;
    const buffer = new Uint8Array(256);
    const timer = setInterval(() => {
      const analyser = recorderRef.current.analyser;
      if (!analyser || isSpeakingRef.current) {
        loudMs = 0;
        return;
      }
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) sum += ((buffer[i] - 128) / 128) ** 2;
      const level = Math.sqrt(sum / buffer.length);
      const recentlyHeard = Date.now() - lastHeardAtRef.current < 2500;
      // Speech has pauses, so quiet moments only drain the counter instead of resetting it.
      loudMs = recentlyHeard ? 0 : Math.max(0, loudMs + (level > 0.05 ? 250 : -100));
      if (loudMs >= 2500) {
        loudMs = 0;
        logVoice("recogniser deaf while the mic hears speech -> turning server transcription off");
        recorderRef.current.broken = true;
        releaseMic();
        stopRecognition();
        setTimeout(() => startListening(), 300);
        callbacksRef.current.onServerSttFailed?.();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [mode, releaseMic, stopRecognition, startListening]);

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

  // Tap-to-finish: sends what has been heard so far without waiting for silence.
  const finishNow = useCallback(() => dispatchCommand(), [dispatchCommand]);

  return { supported, startListening, stopRecognition, finishNow };
}