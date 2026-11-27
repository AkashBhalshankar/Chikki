// Dark is the default look; visitors can switch to a light theme. The choice is
// remembered in the browser. ?theme=light or ?theme=dark in the address also sets it.

const KEY = "chikki_theme";
export const THEMES = ["dark", "light"];

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : null;
}

export function readTheme(search = "", storage = globalThis.localStorage) {
  const fromAddress = normalizeTheme(new URLSearchParams(search).get("theme"));
  if (fromAddress) return fromAddress;
  try {
    return normalizeTheme(storage?.getItem(KEY)) || "dark";
  } catch (_) {
    return "dark";
  }
}

export function applyTheme(theme, root = globalThis.document?.documentElement, storage = globalThis.localStorage) {
  const value = normalizeTheme(theme) || "dark";
  if (root) {
    if (value === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
  }
  try {
    globalThis.document?.querySelector('meta[name="theme-color"]')?.setAttribute("content", value === "light" ? "#f4f5fb" : "#09090b");
  } catch (_) {}
  try {
    storage?.setItem(KEY, value);
  } catch (_) {}
  return value;
}

export function nextTheme(theme) {
  return theme === "light" ? "dark" : "light";
}
