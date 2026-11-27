// Visitor preferences, kept in this browser only.

const KEY = "chikki_settings";

export const DEFAULTS = {
  voice: "neerja", speed: 1, pause: "normal", sounds: true, transcript: false, accent: "violet",
  skin: "midnight", textSize: "normal", readable: false, outfit: "none", haptics: true, contrast: false, cursor: true, calm: false,
};

export const ACCENTS = [
  { id: "violet", label: "Violet" },
  { id: "teal", label: "Teal" },
  { id: "amber", label: "Amber" },
];

export const SKINS = [
  { id: "midnight", label: "Midnight" },
  { id: "sunrise", label: "Sunrise" },
  { id: "forest", label: "Forest" },
  { id: "ocean", label: "Ocean" },
];

export const TEXT_SIZES = [
  { id: "small", label: "Small", px: 14 },
  { id: "normal", label: "Normal", px: 16 },
  { id: "large", label: "Large", px: 18 },
  { id: "xlarge", label: "Extra large", px: 20 },
];

export const OUTFITS = [
  { id: "none", label: "None" },
  { id: "glasses", label: "Glasses" },
  { id: "headset", label: "Headset" },
  { id: "cap", label: "Grad cap" },
];

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

const TRAILING_CONNECTORS = new Set([
  "and", "but", "or", "so", "the", "a", "an", "of", "to", "for", "with", "about", "in", "on", "is", "are", "was",
  "that", "which", "because", "also", "like", "um", "uh", "hmm",
]);

// How long to wait for more speech after a result. A finished-sounding sentence is sent sooner; one that ends
// on "and", "the", "um"... is clearly not finished, so it gets longer. Words are what the recogniser heard.
export function settleDelay(text, pause, isFinal) {
  const base = isFinal ? pause.afterFinal : pause.afterInterim;
  const words = String(text || "").trim().toLowerCase().replace(/[.,?!।]+$/g, "").split(/\s+/).filter(Boolean);
  if (!words.length) return base;
  if (TRAILING_CONNECTORS.has(words[words.length - 1])) return Math.round(base * 1.6);
  const endsLikeASentence = /[.?!।]\s*$/.test(String(text).trim());
  if (isFinal && (endsLikeASentence || words.length >= 4)) return Math.max(280, Math.round(base * 0.65));
  return base;
}

export function normalizeSettings(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    voice: VOICES.some((v) => v.id === value.voice) ? value.voice : DEFAULTS.voice,
    speed: SPEEDS.some((s) => s.value === value.speed) ? value.speed : DEFAULTS.speed,
    pause: PAUSES[value.pause] ? value.pause : DEFAULTS.pause,
    sounds: typeof value.sounds === "boolean" ? value.sounds : DEFAULTS.sounds,
    accent: ACCENTS.some((a) => a.id === value.accent) ? value.accent : DEFAULTS.accent,
    transcript: typeof value.transcript === "boolean" ? value.transcript : DEFAULTS.transcript,
    skin: SKINS.some((x) => x.id === value.skin) ? value.skin : DEFAULTS.skin,
    textSize: TEXT_SIZES.some((x) => x.id === value.textSize) ? value.textSize : DEFAULTS.textSize,
    readable: typeof value.readable === "boolean" ? value.readable : DEFAULTS.readable,
    outfit: OUTFITS.some((x) => x.id === value.outfit) ? value.outfit : DEFAULTS.outfit,
    haptics: typeof value.haptics === "boolean" ? value.haptics : DEFAULTS.haptics,
    contrast: typeof value.contrast === "boolean" ? value.contrast : DEFAULTS.contrast,
    cursor: typeof value.cursor === "boolean" ? value.cursor : DEFAULTS.cursor,
    calm: typeof value.calm === "boolean" ? value.calm : DEFAULTS.calm,
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
  try {
    window.dispatchEvent(new Event("chikki:settings"));
  } catch (_) {}
  return clean;
}

// Applies the chosen accent colour to the whole page ("violet" is the default look).
export function applyAccent(accent) {
  try {
    const root = document.documentElement;
    if (accent && accent !== "violet") root.dataset.accent = accent;
    else delete root.dataset.accent;
  } catch (_) {}
}

// Applies everything that changes how the page looks: accent colour, background skin, text size and font.
export function applyLook(settings) {
  applyAccent(settings.accent);
  try {
    const root = document.documentElement;
    if (settings.skin && settings.skin !== "midnight") root.dataset.skin = settings.skin;
    else delete root.dataset.skin;
    if (settings.calm) root.dataset.calm = "on";
    else delete root.dataset.calm;
    if (settings.contrast) root.dataset.contrast = "high";
    else delete root.dataset.contrast;
    if (settings.readable) root.dataset.font = "readable";
    else delete root.dataset.font;
    const size = TEXT_SIZES.find((x) => x.id === settings.textSize) || TEXT_SIZES[1];
    root.style.fontSize = size.px === 16 ? "" : `${size.px}px`;
  } catch (_) {}
}
