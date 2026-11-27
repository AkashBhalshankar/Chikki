// Two soft chimes: one when Chikki starts listening, one when an answer arrives.
// Built from a tiny oscillator, so there are no audio files to load.

import { readSettings } from "./settings.js";

let context = null;

const NOTES = {
  listen: [523.25, 783.99], // rising and bright: "go ahead"
  done: [659.25, 783.99, 987.77], // a gentle three-note lift: "here you go"
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
      const at = start + index * 0.09;
      // a soft bell: the note plus a quiet octave above it, with a quick attack and a long fade
      [[frequency, 0.05], [frequency * 2, 0.014]].forEach(([hz, level]) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(level, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.45);
      });
    });
  } catch (_) {
    // a missing chime must never affect the conversation
  }
}
