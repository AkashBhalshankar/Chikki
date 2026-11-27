// Minimal service worker so Chikki can be installed as an app.
// It deliberately caches nothing: every request goes to the network, so a new deploy is never
// hidden behind stale files. If you are offline the browser shows its normal offline page.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
