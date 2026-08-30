// LandslideAI Service Worker — offline app-shell caching + local notification bridge
const CACHE_NAME = "landslideai-cache-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
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

// Network-first for API calls (always want fresh risk/weather/shelter data),
// cache-first fallback for the app shell so the UI still loads offline.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isApiCall = url.pathname.startsWith("/api") || url.hostname.includes("onrender.com") || url.hostname.includes("open-meteo.com");

  if (isApiCall) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ success: false, offline: true, error: "You're offline. Showing last-known data where available." }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => caches.match("/index.html")))
  );
});

// Bridge: the page posts a message here to trigger a local notification —
// this works even when the tab is backgrounded, without needing a full push server.
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
      if (clientsArr.length > 0) {
        return clientsArr[0].focus();
      }
      return self.clients.openWindow("/");
    })
  );
});

// Real Web Push support (for future use once a VAPID/push backend is added)
self.addEventListener("push", (event) => {
  let data = { title: "LandslideAI Alert", body: "A risk zone status has changed." };
  try {
    if (event.data) data = event.data.json();
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      vibrate: [200, 100, 200],
    })
  );
});
