// LandslideAI Service Worker — offline app-shell caching + local notification bridge
const CACHE_NAME = "landslideai-cache-v2";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isApiCall =
    url.pathname.startsWith("/api") ||
    url.hostname.includes("onrender.com") ||
    url.hostname.includes("open-meteo.com");

  if (isApiCall) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({
            success: false,
            offline: true,
            error: "Offline mode. Displaying cached data where available.",
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  // Network-first for HTML navigation to eliminate black screen on first visit
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/index.html");
        return cached || Response.error();
      })
    );
    return;
  }

  // Cache-first with network fallback for assets
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === "basic") {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match("/index.html"))
      );
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, body, tag } = event.data.payload || {};
    self.registration.showNotification(title || "LandslideAI Alert", {
      body: body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: tag || "landslideai-alert",
      vibrate: [200, 100, 200],
      requireInteraction: true,
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsArr) => {
      if (clientsArr.length > 0) return clientsArr[0].focus();
      return self.clients.openWindow("/");
    })
  );
});