// True on phones and tablets, where a tel: link opens the dialler.
// On desktop a tel: link does nothing, so the Call button is hidden there.
export function isMobileDevice(nav = globalThis.navigator, win = globalThis.window) {
  const agent = nav?.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(agent)) return true;
  // iPadOS reports a desktop user agent but has a touch screen.
  if (nav?.platform === "MacIntel" && (nav?.maxTouchPoints || 0) > 1) return true;
  return Boolean(win?.matchMedia?.("(pointer: coarse)")?.matches && (nav?.maxTouchPoints || 0) > 0);
}

export function telHref(phone = "") {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
