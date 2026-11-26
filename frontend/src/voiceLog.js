// A short log of the voice pipeline, shown on screen when the page is opened with ?debug=1.
// It helps find where listening stops on a particular device.

const lines = [];

export function logVoice(message) {
  lines.push(`${new Date().toLocaleTimeString()} ${message}`);
  if (lines.length > 12) lines.shift();
  try {
    window.dispatchEvent(new CustomEvent("chikki-voice-log"));
  } catch (_) {}
}

export function voiceLogLines() {
  return [...lines];
}
