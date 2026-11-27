// A light vibration on phones for sending and receiving. Does nothing where unsupported or when switched off.

import { readSettings } from "./settings.js";

export function buzz(pattern = 12) {
  try {
    if (!readSettings().haptics) return;
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch (_) {
    // haptics are a nicety; never let them affect the conversation
  }
}
