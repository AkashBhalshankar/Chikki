// The Analytics button is for the site owner, so it stays hidden from visitors.
// Reveal it for the current browser tab with ?admin=1 in the address, or toggle it
// with Ctrl+Shift+A. The dashboard itself still needs the admin token.

const KEY = "chikki_admin_ui";

/** Returns true, false, or null (no instruction) from a URL search string. */
export function adminFromSearch(search = "") {
  const value = new URLSearchParams(search).get("admin");
  if (value === null) return null;
  return !["0", "false", "off"].includes(value.toLowerCase());
}

export function readAdminUi(storage = globalThis.sessionStorage) {
  try {
    return storage?.getItem(KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function writeAdminUi(enabled, storage = globalThis.sessionStorage) {
  try {
    if (enabled) storage?.setItem(KEY, "1");
    else storage?.removeItem(KEY);
  } catch (_) {}
}

export function isToggleShortcut(event) {
  return Boolean(event.ctrlKey && event.shiftKey && String(event.key).toLowerCase() === "a");
}
