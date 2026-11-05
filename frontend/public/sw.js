// Service worker for installability + a small offline shell.
//
// Strategy:
//   - navigation (index.html) -> NETWORK FIRST, so a new deploy is picked up
//     immediately and never serves a stale shell (which previously caused a
//     white screen because the cached HTML referenced deleted JS bundles);
//     fall back to the cached shell only when offline.
//   - static assets (/assets/*, icons) -> CACHE FIRST (Vite filenames are
//     content-hashed, so they are immutable and safe to cache).
//   - /api, /auth, /media -> always network (never cached).
const CACHE = "karaoke-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never intercept backend calls.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/media/")
  ) {
    return;
  }

  // Navigation (the HTML shell) -> network first.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Static assets -> cache first.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return response;
      });
    }),
  );
});
