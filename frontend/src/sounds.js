// Two soft chimes: one when Chikki starts listening, one when an answer arrives.
// Built from a tiny oscillator, so there are no audio files to load.

import { readSettings } from "./settings.js";

let context = null;

const NOTES = {
  listen: [660, 880], // rising: "go ahead"
  done: [880, 660], // falling: "here you go"
};

export function playChime(kind) {
  try {
    if (!readSettings().sounds || !NOTES[kind]) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    context = context || new Ctx();
    if (context.state === "suspended") context.resume?.().catch(() => {});
    const start = context.currentTime;
    NOTES[kind].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = start + index * 0.11;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.05, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.25);
    });
  } catch (_) {
    // a missing chime must never affect the conversation
  }
}
