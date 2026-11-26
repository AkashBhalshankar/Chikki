// Visitor preferences, kept in this browser only.

const KEY = "chikki_settings";

export const DEFAULTS = { voice: "neerja", speed: 1, pause: "normal", sounds: true };

export const VOICES = [
  { id: "neerja", label: "Neerja (Indian English)" },
  { id: "sonia", label: "Sonia (British English)" },
  { id: "jenny", label: "Jenny (American English)" },
];

export const SPEEDS = [
  { value: 0.9, label: "Slower" },
  { value: 1, label: "Normal" },
  { value: 1.15, label: "Faster" },
];

// How long Chikki waits after you stop talking before it answers.
export const PAUSES = {
  fast: { id: "fast", label: "Quick", afterFinal: 500, afterInterim: 1100 },
  normal: { id: "normal", label: "Normal", afterFinal: 800, afterInterim: 1600 },
  patient: { id: "patient", label: "Patient", afterFinal: 1300, afterInterim: 2600 },
};

export function normalizeSettings(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    voice: VOICES.some((v) => v.id === value.voice) ? value.voice : DEFAULTS.voice,
    speed: SPEEDS.some((s) => s.value === value.speed) ? value.speed : DEFAULTS.speed,
    pause: PAUSES[value.pause] ? value.pause : DEFAULTS.pause,
    sounds: typeof value.sounds === "boolean" ? value.sounds : DEFAULTS.sounds,
  };
}

export function readSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch (_) {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  const clean = normalizeSettings(settings);
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch (_) {}
  return clean;
}
