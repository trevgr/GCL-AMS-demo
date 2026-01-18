// public/sw.js

const CACHE_NAME = "grassroots-ams-v1";
const OFFLINE_URLS = [
  "/",
  "/teams",
  "/reports",
  "/calendar",
];

// Install: pre-cache a few core pages
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: cleanup old caches if needed
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GETs over http/https, ignore extensions, devtools, etc.
  if (
    request.method !== "GET" ||
    !request.url.startsWith("http")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache a copy on success
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, copy).catch(() => {});
        });
        return response;
      })
      .catch(() =>
        caches.match(request).then((res) => res || Promise.reject())
      )
  );
});
