// Measures how loud Chikki's voice is right now so the mouth can follow it.
// It only listens (a copy of the stream goes to an analyser); the audio itself is never rerouted,
// so a failure here can never make Chikki go silent. Where the browser cannot do it (Safari has no
// captureStream) the mouth keeps its timed flapping instead.

import { motionValue } from "framer-motion";

// -1 means "no live measurement"; 0 to 1 is the current loudness.
export const mouthLevel = motionValue(-1);

let context = null;

function getContext() {
  if (!context) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    context = new Ctx();
  }
  if (context.state === "suspended") context.resume?.().catch(() => {});
  return context;
}

// Returns a function that stops measuring.
export function attachLevelMeter(audio) {
  try {
    if (typeof audio.captureStream !== "function") return () => {};
    const ctx = getContext();
    if (!ctx || ctx.state !== "running") return () => {};
    const stream = audio.captureStream();
    if (!stream.getAudioTracks().length) return () => {};
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let smoothed = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) sum += ((buffer[i] - 128) / 128) ** 2;
      const target = Math.min(1, Math.sqrt(sum / buffer.length) * 5);
      smoothed += (target - smoothed) * 0.45; // ease so the mouth does not flicker
      mouthLevel.set(smoothed);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      mouthLevel.set(-1);
      try {
        source.disconnect();
        analyser.disconnect();
      } catch (_) {}
    };
  } catch (_) {
    return () => {};
  }
}
