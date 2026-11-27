// Answers a visitor stars to keep. Stored only in their own browser.

const KEY = "chikki_saved";
const MAX_SAVED = 30;

function store() {
  try {
    return window.localStorage;
  } catch (_) {
    return null;
  }
}

export function savedId(question, answer) {
  const text = `${question}\n${answer}`;
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `a${(hash >>> 0).toString(36)}`;
}

export function loadSaved(storage = store()) {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.answer === "string").slice(0, MAX_SAVED)
      : [];
  } catch (_) {
    return [];
  }
}

export function persistSaved(list, storage = store()) {
  try {
    storage?.setItem(KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
  } catch (_) {
    // saving is a convenience; a full or blocked store must not break the chat
  }
}

// Adds the answer to the front of the list, or removes it if it is already there.
export function toggleSaved(list, item) {
  return list.some((entry) => entry.id === item.id)
    ? list.filter((entry) => entry.id !== item.id)
    : [item, ...list].slice(0, MAX_SAVED);
}
