// Small "Today 3:40 PM" markers between messages in a long chat.

const GAP_MS = 30 * 60 * 1000;

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatMarker(at, now = Date.now(), locale = undefined) {
  const when = new Date(at);
  const today = new Date(now);
  const yesterday = new Date(now - 24 * 60 * 60 * 1000);
  const time = when.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (sameDay(when, today)) return `Today ${time}`;
  if (sameDay(when, yesterday)) return `Yesterday ${time}`;
  return `${when.toLocaleDateString(locale, { month: "short", day: "numeric" })}, ${time}`;
}

// The marker to show above a message, or null. Shown for the first timed message, on a new day, and after a
// pause of half an hour; messages saved before times were recorded have none and simply get no marker.
export function timeMarker(previousAt, at, now = Date.now(), locale = undefined) {
  if (!Number.isFinite(at)) return null;
  if (!Number.isFinite(previousAt)) return formatMarker(at, now, locale);
  const gap = at - previousAt;
  if (!sameDay(new Date(previousAt), new Date(at)) || gap >= GAP_MS) return formatMarker(at, now, locale);
  return null;
}
